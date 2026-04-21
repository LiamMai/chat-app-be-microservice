import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException, CacheKey, CacheService, PageQueryDto, paginateMongo } from '@app/common';
import { Message, MessageDocument, MessageType } from '../entities/message.entity';
import { RoomService } from '../rooms/room.service';

const RECENT_CACHE_SIZE = 50;
const RECENT_CACHE_TTL  = 3600; // 1 h
const PRESENCE_TTL      = 30;   // seconds

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private readonly msgModel: Model<MessageDocument>,
    private readonly roomService: RoomService,
    private readonly cache: CacheService,
  ) {}

  // ── Send message ──────────────────────────────────────────────────────────

  async sendMessage(payload: {
    roomId: string;
    senderId: string;
    content: string;
    type?: MessageType;
  }) {
    const { roomId, senderId, content, type = MessageType.TEXT } = payload;

    if (!Types.ObjectId.isValid(roomId)) throw AppException.badRequest('Invalid room ID');

    const isMember = await this.roomService.isMember(roomId, senderId);
    if (!isMember) throw AppException.forbidden('Not a member of this room');

    const message = await this.msgModel.create({
      roomId: new Types.ObjectId(roomId),
      senderId,
      content,
      type,
      readBy: [senderId],
    });

    // Prepend to recent-messages cache (keep last N)
    const cacheKey = CacheKey.recentMessages(roomId);
    await this.cache.lPush({ key: cacheKey, values: [JSON.stringify(message.toObject())] });
    await this.cache.lTrim({ key: cacheKey, start: 0, stop: RECENT_CACHE_SIZE - 1 });
    await this.cache.expire(cacheKey, RECENT_CACHE_TTL);

    // Publish to room channel for WebSocket fan-out
    await this.cache.publish(CacheKey.roomChannel(roomId), message.toObject());

    return message;
  }

  // ── Message history (paginated) ───────────────────────────────────────────

  async getHistory(payload: { roomId: string; userId: string; query: PageQueryDto }) {
    const { roomId, userId, query } = payload;

    if (!Types.ObjectId.isValid(roomId)) throw AppException.badRequest('Invalid room ID');

    const isMember = await this.roomService.isMember(roomId, userId);
    if (!isMember) throw AppException.forbidden('Not a member of this room');

    return paginateMongo(this.msgModel, query, {
      filter: { roomId: new Types.ObjectId(roomId) },
      sort:   { createdAt: -1 },
    });
  }

  // ── Mark messages as read ─────────────────────────────────────────────────

  async markRead(payload: { roomId: string; userId: string }) {
    const { roomId, userId } = payload;

    if (!Types.ObjectId.isValid(roomId)) throw AppException.badRequest('Invalid room ID');

    const isMember = await this.roomService.isMember(roomId, userId);
    if (!isMember) throw AppException.forbidden('Not a member of this room');

    await this.msgModel.updateMany(
      { roomId: new Types.ObjectId(roomId), readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } },
    );

    // Publish read receipt for real-time update
    await this.cache.publish(CacheKey.roomChannel(roomId), {
      event: 'message_read',
      roomId,
      userId,
    });

    return { roomId, userId };
  }

  // ── Presence refresh ──────────────────────────────────────────────────────

  async refreshPresence(userId: string) {
    await this.cache.set(CacheKey.presence(userId), '1', PRESENCE_TTL);
  }
}
