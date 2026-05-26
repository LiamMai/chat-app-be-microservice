import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { AppException, CHAT_PATTERNS, PageQueryDto, SERVICES, USERS_PATTERNS } from '@app/common';
import { CreateRoomDto, RoomTypeDto } from './dto/request.dto';

const RPC_TIMEOUT = 5000;

@Injectable()
export class ChatService {
  constructor(
    @Inject(SERVICES.CHAT) private readonly chatClient: ClientProxy,
    @Inject(SERVICES.USERS) private readonly usersClient: ClientProxy,
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

  async listRooms(userId: string, query?: PageQueryDto) {
    const result = await this.send<{ data: any[]; meta: unknown }>(
      CHAT_PATTERNS.ROOM_LIST, { userId, query },
    );

    const memberIds: string[] = [
      ...new Set(result.data.flatMap((room: any) => room.members as string[])),
    ];

    if (memberIds.length === 0) return result;

    const users = await Promise.all(
      memberIds.map((id) =>
        firstValueFrom(
          this.usersClient.send(USERS_PATTERNS.FIND_BY_ID, { id }).pipe(timeout(RPC_TIMEOUT)),
        ).catch(() => null),
      ),
    );

    const userMap = new Map(
      users.filter(Boolean).map((u: any) => [u.id, u]),
    );

    return {
      ...result,
      data: result.data.map((room: any) => {
        const members = (room.members as string[]).map(
          (id) => userMap.get(id) ?? { id, email: id, firstName: '', lastName: '' },
        );

        let name = room.name;
        if (room.type === RoomTypeDto.DM) {
          const other = members.find((m: any) => m.id !== userId);
          if (other) {
            name = other.username
              || [other.firstName, other.lastName].filter(Boolean).join(' ')
              || other.email
              || null;
          }
        }

        return { ...room, members, name };
      }),
    };
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
