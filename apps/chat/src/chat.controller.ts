import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CHAT_PATTERNS, PageQueryDto } from '@app/common';
import { RoomService } from './rooms/room.service';
import { MessageService } from './messages/message.service';
import { RoomType } from './entities/room.entity';
import { Attachment, MessageType } from './entities/message.entity';

@Controller()
export class ChatController {
  constructor(
    private readonly roomService: RoomService,
    private readonly messageService: MessageService,
  ) {}

  // ── Rooms ─────────────────────────────────────────────────────────────────

  @MessagePattern(CHAT_PATTERNS.ROOM_CREATE)
  createRoom(
    @Payload()
    payload: {
      createdBy: string;
      type: RoomType;
      name?: string;
      members: string[];
    },
  ) {
    return this.roomService.createRoom(payload);
  }

  @MessagePattern(CHAT_PATTERNS.ROOM_GET)
  getRoom(@Payload() { roomId, userId }: { roomId: string; userId: string }) {
    return this.roomService.getRoom(roomId, userId);
  }

  @MessagePattern(CHAT_PATTERNS.ROOM_LIST)
  listRooms(@Payload() { userId, query }: { userId: string; query?: PageQueryDto }) {
    return this.roomService.listRooms(userId, query);
  }

  @MessagePattern(CHAT_PATTERNS.ROOM_ADD_MEMBER)
  addMember(
    @Payload()
    { roomId, requesterId, targetUserId }: { roomId: string; requesterId: string; targetUserId: string },
  ) {
    return this.roomService.addMember(roomId, requesterId, targetUserId);
  }

  @MessagePattern(CHAT_PATTERNS.ROOM_LEAVE)
  leaveRoom(@Payload() { roomId, userId }: { roomId: string; userId: string }) {
    return this.roomService.leaveRoom(roomId, userId);
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  @MessagePattern(CHAT_PATTERNS.MESSAGE_SEND)
  sendMessage(
    @Payload()
    payload: {
      roomId: string;
      senderId: string;
      content: string;
      type?: MessageType;
      attachment?: Attachment | null;
    },
  ) {
    return this.messageService.sendMessage(payload);
  }

  @MessagePattern(CHAT_PATTERNS.MESSAGE_HISTORY)
  getHistory(
    @Payload()
    { roomId, userId, query = {} }: { roomId: string; userId: string; query?: PageQueryDto },
  ) {
    return this.messageService.getHistory({ roomId, userId, query: query as PageQueryDto });
  }

  @MessagePattern(CHAT_PATTERNS.MESSAGE_MARK_READ)
  markRead(@Payload() { roomId, userId }: { roomId: string; userId: string }) {
    return this.messageService.markRead({ roomId, userId });
  }

  @MessagePattern(CHAT_PATTERNS.MESSAGE_EDIT)
  editMessage(
    @Payload() { messageId, userId, content }: { messageId: string; userId: string; content: string },
  ) {
    return this.messageService.editMessage({ messageId, userId, content });
  }

  @MessagePattern(CHAT_PATTERNS.MESSAGE_DELETE)
  deleteMessage(@Payload() { messageId, userId }: { messageId: string; userId: string }) {
    return this.messageService.deleteMessage({ messageId, userId });
  }

  @MessagePattern(CHAT_PATTERNS.MESSAGE_REACT_ADD)
  addReaction(
    @Payload()
    { messageId, userId, emoji }: { messageId: string; userId: string; emoji: string },
  ) {
    return this.messageService.addReaction({ messageId, userId, emoji });
  }

  @MessagePattern(CHAT_PATTERNS.MESSAGE_REACT_REMOVE)
  removeReaction(
    @Payload()
    { messageId, userId, emoji }: { messageId: string; userId: string; emoji: string },
  ) {
    return this.messageService.removeReaction({ messageId, userId, emoji });
  }

  // ── Typing / presence ─────────────────────────────────────────────────────

  @MessagePattern(CHAT_PATTERNS.TYPING_SET)
  setTyping(
    @Payload()
    { roomId, userId, typing }: { roomId: string; userId: string; typing: boolean },
  ) {
    return this.messageService.setTyping({ roomId, userId, typing });
  }

  @MessagePattern(CHAT_PATTERNS.PRESENCE_GET)
  getPresence(@Payload() { userIds }: { userIds: string[] }) {
    return this.messageService.getPresence(userIds);
  }
}
