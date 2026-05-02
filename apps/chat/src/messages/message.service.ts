import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException, CacheKey, CacheService, PageQueryDto, paginateMongo } from '@app/common';
import { Message, MessageDocument, MessageType } from '../entities/message.entity';
import { RoomService } from '../rooms/room.service';
import { MessageCrypto } from './message-crypto';

const RECENT_CACHE_SIZE = 50;
const RECENT_CACHE_TTL  = 3600; // 1 h
const PRESENCE_TTL      = 30;   // seconds

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name) private readonly msgModel: Model<MessageDocument>,
    private readonly roomService: RoomService,
    private readonly cache: CacheService,
    private readonly crypto: MessageCrypto,
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

    // Build doc — encrypted at rest if key configured, else plaintext fallback.
    const baseDoc = {
      roomId: new Types.ObjectId(roomId),
      senderId,
      type,
      readBy: [senderId],
    };

    const stored = this.crypto.isEnabled()
      ? { ...baseDoc, ...this.crypto.encrypt(content), encVersion: 1, content: null }
      : { ...baseDoc, content, encVersion: 0 };

    const created = await this.msgModel.create(stored);
    const obj = created.toObject();

    // Outbound payload: callers + cache + pubsub all get plaintext-shaped doc.
    const outbound = this.crypto.decryptDoc({ ...obj });

    // Prepend to recent-messages cache (keep last N). Cache plaintext shape so
    // history hits don't need a per-item decrypt round-trip.
    const cacheKey = CacheKey.recentMessages(roomId);
    await this.cache.lPush({ key: cacheKey, values: [JSON.stringify(outbound)] });
    await this.cache.lTrim({ key: cacheKey, start: 0, stop: RECENT_CACHE_SIZE - 1 });
    await this.cache.expire(cacheKey, RECENT_CACHE_TTL);

    // Publish for WebSocket fan-out — already plaintext-shaped.
    await this.cache.publish(CacheKey.roomChannel(roomId), outbound);

    return outbound;
  }

  // ── Message history (paginated) ───────────────────────────────────────────

  async getHistory(payload: { roomId: string; userId: string; query: PageQueryDto }) {
    const { roomId, userId, query } = payload;

    if (!Types.ObjectId.isValid(roomId)) throw AppException.badRequest('Invalid room ID');

    const isMember = await this.roomService.isMember(roomId, userId);
    if (!isMember) throw AppException.forbidden('Not a member of this room');

    const page = await paginateMongo(this.msgModel, query, {
      filter: { roomId: new Types.ObjectId(roomId) },
      sort:   { createdAt: -1 },
    });

    // decryptDoc mutates in place — readonly array ref is fine.
    for (const doc of page.data) this.crypto.decryptDoc(doc as any);
    return page;
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
