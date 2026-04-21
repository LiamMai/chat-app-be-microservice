import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { AppException, CHAT_PATTERNS, PageQueryDto, SERVICES } from '@app/common';
import { CreateRoomDto } from './dto/request.dto';

const RPC_TIMEOUT = 5000;

@Injectable()
export class ChatService {
  constructor(
    @Inject(SERVICES.CHAT) private readonly chatClient: ClientProxy,
  ) {}

  private async send<T>(pattern: string, payload: unknown): Promise<T> {
    try {
      return await firstValueFrom<T>(
        this.chatClient.send<T>(pattern, payload).pipe(timeout(RPC_TIMEOUT)),
      );
    } catch (err) {
      if ((err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'EmptyError') {
        throw AppException.internal('Chat service unavailable');
      }
      throw err;
    }
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  createRoom(userId: string, dto: CreateRoomDto) {
    return this.send(CHAT_PATTERNS.ROOM_CREATE, {
      createdBy: userId,
      type: dto.type,
      name: dto.name,
      members: dto.members,
    });
  }

  getRoom(roomId: string, userId: string) {
    return this.send(CHAT_PATTERNS.ROOM_GET, { roomId, userId });
  }

  listRooms(userId: string, query?: PageQueryDto) {
    return this.send(CHAT_PATTERNS.ROOM_LIST, { userId, query });
  }

  addMember(roomId: string, requesterId: string, targetUserId: string) {
    return this.send(CHAT_PATTERNS.ROOM_ADD_MEMBER, { roomId, requesterId, targetUserId });
  }

  leaveRoom(roomId: string, userId: string) {
    return this.send(CHAT_PATTERNS.ROOM_LEAVE, { roomId, userId });
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  sendMessage(userId: string, roomId: string, content: string) {
    return this.send(CHAT_PATTERNS.MESSAGE_SEND, { roomId, senderId: userId, content });
  }

  getHistory(roomId: string, userId: string, query: PageQueryDto) {
    return this.send(CHAT_PATTERNS.MESSAGE_HISTORY, { roomId, userId, query });
  }

  markRead(roomId: string, userId: string) {
    return this.send(CHAT_PATTERNS.MESSAGE_MARK_READ, { roomId, userId });
  }
}
