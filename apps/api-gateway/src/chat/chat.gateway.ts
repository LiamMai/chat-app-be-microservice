import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import {
  AppException,
  CacheKey,
  CacheService,
  JwtPayload,
  REDIS_SUB_CLIENT,
  SERVICES,
  USERS_PATTERNS,
} from '@app/common';
import { ChatService } from './chat.service';
import { UsersService } from '../users/users.service';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

const PRESENCE_TTL = 30; // seconds — client must heartbeat within this window
const TYPING_TTL = 5; // seconds — typing indicator auto-expires

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chat',
})
export class ChatGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer() private readonly server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  /** socketId → userId */
  private readonly socketUser = new Map<string, string>();
  /** userId → Set<socketId> (one user may have multiple tabs) */
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    private readonly cache: CacheService,
    @Inject(REDIS_SUB_CLIENT) private readonly redisSub: Redis,
    @Inject(SERVICES.USERS) private readonly usersClient: ClientProxy,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  afterInit() {
    this.logger.log('ChatGateway initialised');
  }

  onModuleInit() {
    // Subscribe to all room channels — pattern subscribe
    this.redisSub.psubscribe('chat:room:*', (err) => {
      if (err) this.logger.error('Redis psubscribe failed', err.message);
      else this.logger.log('Subscribed to chat:room:* channels');
    });

    this.redisSub.on('pmessage', (_pattern, channel, rawMessage) => {
      // channel = "chat:room:<roomId>"
      const roomId = channel.replace('chat:room:', '');
      let payload: unknown;
      try {
        payload = JSON.parse(rawMessage);
      } catch {
        payload = rawMessage;
      }

      // Determine event name — message_read vs new_message
      const event =
        payload && typeof payload === 'object' && (payload as any).event
          ? (payload as any).event
          : 'new_message';

      this.server.to(roomId).emit(event, payload);
    });
  }

  async onModuleDestroy() {
    await this.redisSub.punsubscribe('chat:room:*');
  }

  // ── Connection / Disconnection ────────────────────────────────────────────

  async handleConnection(client: Socket) {
    const userId = this.authenticate(client);
    if (!userId) {
      client.disconnect(true);
      return;
    }

    // Snapshot of who is already online (before adding self) — sent only to
    // this client so a late joiner learns about peers that connected earlier.
    // Without this, presence is only learned from live user_online broadcasts,
    // so the first-connected user never hears about the second.
    const alreadyOnline = Array.from(this.userSockets.keys()).filter(
      (id) => id !== userId,
    );

    // Track socket ↔ user
    this.socketUser.set(client.id, userId);
    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
    this.userSockets.get(userId)!.add(client.id);

    // Mark online
    await this.cache.set(CacheKey.presence(userId), Date.now(), PRESENCE_TTL);

    // Seed this client with the current online set, then notify others of us.
    client.emit('online_users', { userIds: alreadyOnline });
    client.broadcast.emit('user_online', { userId });

    this.logger.debug(`Connected: ${client.id} (user ${userId})`);
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;

    this.socketUser.delete(client.id);
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        // Last socket closed — mark offline
        await this.cache.del(CacheKey.presence(userId));
        this.server.emit('user_offline', { userId });
      }
    }

    this.logger.debug(`Disconnected: ${client.id} (user ${userId})`);
  }

  // ── Room events ───────────────────────────────────────────────────────────

  /** Client joins a Socket.IO room to receive its events */
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() { roomId }: { roomId: string },
  ) {
    const userId = this.requireUser(client);
    // Membership verified inside chat service (via RMQ → chat microservice)
    await this.chatService.getRoom(roomId, userId);
    await client.join(roomId);
    client.emit('joined_room', { roomId });
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() { roomId }: { roomId: string },
  ) {
    await client.leave(roomId);
    client.emit('left_room', { roomId });
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() { roomId, content }: { roomId: string; content: string },
  ) {
    const userId = this.requireUser(client);
    // Persist + publish via RMQ → chat service → Redis publish → pmessage handler above
    await this.chatService.sendMessage(userId, roomId, content);
    // No direct emit here — Redis pmessage handler broadcasts to the room
  }

  // ── Typing indicators ─────────────────────────────────────────────────────

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() { roomId }: { roomId: string },
  ) {
    const userId = this.requireUser(client);

    const user = await firstValueFrom<{ firstName: string; lastName: string }>(
      this.usersClient.send(USERS_PATTERNS.FIND_BY_ID, { id: userId }),
    );
    if (!user) throw AppException.notFound('User not found');

    await this.cache.sAdd(CacheKey.typing(roomId), userId);
    await this.cache.expire(CacheKey.typing(roomId), TYPING_TTL);

    client.to(roomId).emit('user_typing', {
      userId,
      roomId,
      typing: true,
      userName: `${user.firstName} ${user.lastName}`,
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() { roomId }: { roomId: string },
  ) {
    const userId = this.requireUser(client);
    await this.cache.sRem(CacheKey.typing(roomId), userId);
    client.to(roomId).emit('user_typing', { userId, roomId, typing: false });
  }

  // ── Heartbeat (keeps presence alive) ─────────────────────────────────────

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = this.requireUser(client);
    await this.cache.set(CacheKey.presence(userId), Date.now(), PRESENCE_TTL);
    client.emit('heartbeat_ack', { ts: Date.now() });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private authenticate(client: Socket): string | null {
    const token =
      (client.handshake.auth?.token as string) ??
      (client.handshake.headers?.authorization as string)?.replace(
        'Bearer ',
        '',
      );

    if (!token) return null;

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      if (payload.type !== 'access') return null;
      return payload.sub;
    } catch {
      return null;
    }
  }

  private requireUser(client: Socket): string {
    const userId = this.socketUser.get(client.id);
    if (!userId) throw new WsException('Unauthenticated');
    return userId;
  }
}
