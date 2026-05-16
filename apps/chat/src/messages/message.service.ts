import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AppException,
  CacheKey,
  CacheService,
  PageQueryDto,
  SERVICES,
  USERS_PATTERNS,
  paginateMongo,
} from '@app/common';
import {
  Attachment,
  Message,
  MessageDocument,
  MessageType,
} from '../entities/message.entity';
import { RoomService } from '../rooms/room.service';
import { MessageCrypto } from './message-crypto';

const RECENT_CACHE_SIZE = 50;
const RECENT_CACHE_TTL = 3600; // 1 h
const PRESENCE_TTL = 30; // seconds
const TYPING_TTL = 5; // seconds
const RPC_TIMEOUT = 5000;

@Injectable()
export class MessageService {
  constructor(
    @InjectModel(Message.name)
    private readonly msgModel: Model<MessageDocument>,
    private readonly roomService: RoomService,
    private readonly cache: CacheService,
    private readonly crypto: MessageCrypto,
    @Inject(SERVICES.USERS) private readonly usersClient: ClientProxy,
  ) {}

  // ── Send message ──────────────────────────────────────────────────────────

  async sendMessage(payload: {
    roomId: string;
    senderId: string;
    content: string;
    type?: MessageType;
    attachment?: Attachment | null;
  }) {
    const {
      roomId,
      senderId,
      content,
      type = MessageType.TEXT,
      attachment = null,
    } = payload;

    if (!Types.ObjectId.isValid(roomId))
      throw AppException.badRequest('Invalid room ID');

    const isMember = await this.roomService.isMember(roomId, senderId);
    if (!isMember) throw AppException.forbidden('Not a member of this room');

    if (type !== MessageType.TEXT && !attachment) {
      throw AppException.badRequest(
        'attachment required for non-text messages',
      );
    }

    const baseDoc = {
      roomId: new Types.ObjectId(roomId),
      senderId,
      type,
      attachment,
      readBy: [senderId],
    };

    const stored = this.crypto.isEnabled()
      ? {
          ...baseDoc,
          ...this.crypto.encrypt(content),
          encVersion: 1,
          content: null,
        }
      : { ...baseDoc, content, encVersion: 0 };

    const created = await this.msgModel.create(stored);
    const obj = created.toObject();
    const outbound = this.crypto.decryptDoc({ ...obj });

    const cacheKey = CacheKey.recentMessages(roomId);
    await this.cache.lPush({
      key: cacheKey,
      values: [JSON.stringify(outbound)],
    });
    await this.cache.lTrim({
      key: cacheKey,
      start: 0,
      stop: RECENT_CACHE_SIZE - 1,
    });
    await this.cache.expire(cacheKey, RECENT_CACHE_TTL);

    await this.cache.publish(CacheKey.roomChannel(roomId), {
      event: 'new_message',
      message: outbound,
    });

    return outbound;
  }

  // ── Edit message ──────────────────────────────────────────────────────────

  async editMessage(payload: {
    messageId: string;
    userId: string;
    content: string;
  }) {
    const { messageId, userId, content } = payload;
    if (!Types.ObjectId.isValid(messageId))
      throw AppException.badRequest('Invalid message ID');

    const msg = await this.msgModel.findById(messageId);
    if (!msg) throw AppException.notFound('Message not found');
    if (msg.senderId !== userId)
      throw AppException.forbidden('Only sender can edit');
    if (msg.deletedAt)
      throw AppException.badRequest('Cannot edit a deleted message');

    if (this.crypto.isEnabled()) {
      const { ciphertext, iv } = this.crypto.encrypt(content);
      msg.ciphertext = ciphertext;
      msg.iv = iv;
      msg.content = null;
      msg.encVersion = 1;
    } else {
      msg.content = content;
      msg.ciphertext = null;
      msg.iv = null;
      msg.encVersion = 0;
    }
    msg.editedAt = new Date();
    await msg.save();

    const outbound = this.crypto.decryptDoc({ ...msg.toObject() });
    await this.cache.publish(CacheKey.roomChannel(msg.roomId.toString()), {
      event: 'message_edited',
      message: outbound,
    });
    return outbound;
  }

  // ── Delete message (soft) ─────────────────────────────────────────────────

  async deleteMessage(payload: { messageId: string; userId: string }) {
    const { messageId, userId } = payload;
    if (!Types.ObjectId.isValid(messageId))
      throw AppException.badRequest('Invalid message ID');

    const msg = await this.msgModel.findById(messageId);
    if (!msg) throw AppException.notFound('Message not found');
    if (msg.senderId !== userId)
      throw AppException.forbidden('Only sender can delete');
    if (msg.deletedAt) return { messageId, alreadyDeleted: true };

    msg.deletedAt = new Date();
    msg.content = null;
    msg.ciphertext = null;
    msg.iv = null;
    msg.attachment = null;
    await msg.save();

    await this.cache.publish(CacheKey.roomChannel(msg.roomId.toString()), {
      event: 'message_deleted',
      messageId,
      roomId: msg.roomId.toString(),
    });
    return { messageId, deletedAt: msg.deletedAt };
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  async addReaction(payload: {
    messageId: string;
    userId: string;
    emoji: string;
  }) {
    const { messageId, userId, emoji } = payload;
    if (!Types.ObjectId.isValid(messageId))
      throw AppException.badRequest('Invalid message ID');
    if (!emoji || emoji.length > 16)
      throw AppException.badRequest('Invalid emoji');

    const msg = await this.msgModel.findById(messageId).select('roomId');
    if (!msg) throw AppException.notFound('Message not found');
    const isMember = await this.roomService.isMember(
      msg.roomId.toString(),
      userId,
    );
    if (!isMember) throw AppException.forbidden('Not a member of this room');

    await this.msgModel.updateOne(
      { _id: messageId },
      { $addToSet: { [`reactions.${emoji}`]: userId } },
    );

    await this.cache.publish(CacheKey.roomChannel(msg.roomId.toString()), {
      event: 'reaction_added',
      messageId,
      userId,
      emoji,
    });
    return { messageId, userId, emoji };
  }

  async removeReaction(payload: {
    messageId: string;
    userId: string;
    emoji: string;
  }) {
    const { messageId, userId, emoji } = payload;
    if (!Types.ObjectId.isValid(messageId))
      throw AppException.badRequest('Invalid message ID');

    const msg = await this.msgModel.findById(messageId).select('roomId');
    if (!msg) throw AppException.notFound('Message not found');

    await this.msgModel.updateOne(
      { _id: messageId },
      { $pull: { [`reactions.${emoji}`]: userId } },
    );
    // Drop empty arrays so the map stays clean.
    await this.msgModel.updateOne(
      { _id: messageId, [`reactions.${emoji}`]: { $size: 0 } },
      { $unset: { [`reactions.${emoji}`]: '' } },
    );

    await this.cache.publish(CacheKey.roomChannel(msg.roomId.toString()), {
      event: 'reaction_removed',
      messageId,
      userId,
      emoji,
    });
    return { messageId, userId, emoji };
  }

  // ── Typing indicator ──────────────────────────────────────────────────────

  /**
   * Mark a user as typing in a room. Stored in a Redis SET with a short TTL
   * — the set itself expires, so individual entries fade naturally if the
   * client stops sending heartbeats.
   */
  async setTyping(payload: {
    roomId: string;
    userId: string;
    typing: boolean;
  }) {
    const { roomId, userId, typing } = payload;
    if (!Types.ObjectId.isValid(roomId))
      throw AppException.badRequest('Invalid room ID');

    const isMember = await this.roomService.isMember(roomId, userId);
    if (!isMember) throw AppException.forbidden('Not a member of this room');

    const user = await firstValueFrom<{ firstName: string; lastName: string }>(
      this.usersClient
        .send(USERS_PATTERNS.FIND_BY_ID, { id: userId })
        .pipe(timeout(RPC_TIMEOUT)),
    );
    if (!user) throw AppException.notFound('User not found');

    const key = CacheKey.typing(roomId);
    if (typing) {
      await this.cache.sAdd(key, userId);
      await this.cache.expire(key, TYPING_TTL);
    } else {
      await this.cache.sRem(key, userId);
    }

    const data = {
      roomId,
      userId,
      typing,
      userName: `${user.firstName} ${user.lastName}`,
    };

    await this.cache.publish(CacheKey.roomChannel(roomId), {
      event: 'typing',
      ...data
    });
    return data
  }

  // ── Message history (paginated) ───────────────────────────────────────────

  async getHistory(payload: {
    roomId: string;
    userId: string;
    query: PageQueryDto;
  }) {
    const { roomId, userId, query } = payload;

    if (!Types.ObjectId.isValid(roomId))
      throw AppException.badRequest('Invalid room ID');

    const isMember = await this.roomService.isMember(roomId, userId);
    if (!isMember) throw AppException.forbidden('Not a member of this room');

    const page = await paginateMongo(this.msgModel, query, {
      filter: { roomId: new Types.ObjectId(roomId) },
      sort: { createdAt: -1 },
    });

    for (const doc of page.data) this.crypto.decryptDoc(doc as any);
    return page;
  }

  // ── Mark messages as read ─────────────────────────────────────────────────

  async markRead(payload: { roomId: string; userId: string }) {
    const { roomId, userId } = payload;

    if (!Types.ObjectId.isValid(roomId))
      throw AppException.badRequest('Invalid room ID');

    const isMember = await this.roomService.isMember(roomId, userId);
    if (!isMember) throw AppException.forbidden('Not a member of this room');

    await this.msgModel.updateMany(
      { roomId: new Types.ObjectId(roomId), readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } },
    );

    await this.cache.publish(CacheKey.roomChannel(roomId), {
      event: 'message_read',
      roomId,
      userId,
    });

    return { roomId, userId };
  }

  // ── Presence refresh / query ──────────────────────────────────────────────

  async refreshPresence(userId: string) {
    await this.cache.set(CacheKey.presence(userId), Date.now(), PRESENCE_TTL);
  }

  /**
   * Return online + lastSeen for each requested userId.
   *   online    — true if presence key still exists (within PRESENCE_TTL)
   *   lastSeen  — timestamp written on last refreshPresence; null if never
   *               connected since the cache started.
   */
  async getPresence(
    userIds: string[],
  ): Promise<{ userId: string; online: boolean; lastSeen: number | null }[]> {
    const results = await Promise.all(
      userIds.map(async (userId) => {
        const v = await this.cache.get<number>(CacheKey.presence(userId));
        return {
          userId,
          online: v !== null,
          lastSeen: v ?? null,
        };
      }),
    );
    return results;
  }
}
