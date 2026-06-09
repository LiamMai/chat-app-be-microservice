import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException, CacheKey, CacheService, PageDto, PageMetaDto, PageQueryDto } from '@app/common';
import { Room, RoomDocument, RoomType } from '../entities/room.entity';
import { Message, MessageDocument } from '../entities/message.entity';
import { MessageCrypto } from '../messages/message-crypto';

@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Message.name) private readonly msgModel: Model<MessageDocument>,
    private readonly cache: CacheService,
    private readonly crypto: MessageCrypto,
  ) {}

  // ── Create room ───────────────────────────────────────────────────────────

  async createRoom(payload: {
    createdBy: string;
    type: RoomType;
    name?: string;
    members: string[];
  }) {
    const { createdBy, type, name, members } = payload;

    // Ensure creator is always a member
    const memberSet = [...new Set([createdBy, ...members])];

    if (type === RoomType.DM) {
      if (memberSet.length !== 2) {
        throw AppException.badRequest('DM room requires exactly 2 members');
      }
      // Prevent duplicate DMs between same pair
      const existing = await this.roomModel.findOne({
        type: RoomType.DM,
        members: { $all: memberSet, $size: 2 },
      });
      if (existing) return existing;
    }

    const room = await this.roomModel.create({
      type,
      name: name ?? null,
      members: memberSet,
      createdBy,
    });

    // Warm membership cache
    await this.cache.sAdd(CacheKey.roomMembers(room.id), ...memberSet);

    return room;
  }

  // ── Get room ──────────────────────────────────────────────────────────────

  async getRoom(roomId: string, userId: string) {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw AppException.notFound('Room not found');
    if (!room.members.includes(userId)) throw AppException.forbidden('Not a member');
    return room;
  }

  // ── List rooms for a user (enriched) ──────────────────────────────────────

  /**
   * Returns each room a user belongs to, sorted by recent activity, with:
   *   - lastMessage: latest non-deleted message (decrypted, body trimmed)
   *   - unreadCount: messages in the room missing this user from `readBy`
   *
   * Uses one aggregation pipeline so a 50-room page is one round-trip.
   */
  async listRooms(userId: string, query?: PageQueryDto) {
    const page  = Math.max(1, query?.page  ?? 1);
    const limit = Math.min(query?.limit ?? 20, 100);
    const skip  = (page - 1) * limit;

    const filter = { members: userId };

    const [rows, total] = await Promise.all([
      this.roomModel.aggregate([
        { $match: filter },
        { $sort:  { updatedAt: -1 } },
        { $skip:  skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'messages',
            let:  { roomId: '$_id' },
            pipeline: [
              { $match: { $expr: { $and: [
                { $eq: ['$roomId', '$$roomId'] },
                // missing field !== null in aggregation $eq, so coerce via $ifNull
                { $eq: [{ $ifNull: ['$deletedAt', null] }, null] },
              ] } } },
              { $sort:  { createdAt: -1 } },
              { $limit: 1 },
            ],
            as: 'lastMessage',
          },
        },
        {
          $lookup: {
            from: 'messages',
            let:  { roomId: '$_id' },
            pipeline: [
              { $match: { $expr: { $and: [
                { $eq: ['$roomId', '$$roomId'] },
                { $not: { $in: [userId, '$readBy'] } },
                { $ne: ['$senderId', userId] },
                { $eq: [{ $ifNull: ['$deletedAt', null] }, null] },
              ] } } },
              { $count: 'n' },
            ],
            as: 'unread',
          },
        },
        {
          $addFields: {
            lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
            unreadCount: { $ifNull: [{ $arrayElemAt: ['$unread.n', 0] }, 0] },
          },
        },
        { $project: { unread: 0 } },
      ]),
      this.roomModel.countDocuments(filter),
    ]);

    for (const row of rows) {
      if (row.lastMessage) this.crypto.decryptDoc(row.lastMessage);
    }

    return new PageDto(rows, new PageMetaDto({ page, limit, total }));
  }

  // ── Add member ────────────────────────────────────────────────────────────

  async addMember(roomId: string, requesterId: string, targetUserId: string) {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw AppException.notFound('Room not found');
    if (!room.members.includes(requesterId)) throw AppException.forbidden('Not a member');
    if (room.type === RoomType.DM) throw AppException.badRequest('Cannot add members to a DM');
    if (room.members.includes(targetUserId)) throw AppException.conflict('Already a member');

    room.members.push(targetUserId);
    await room.save();
    await this.cache.sAdd(CacheKey.roomMembers(roomId), targetUserId);
    return room;
  }

  // ── Leave room ────────────────────────────────────────────────────────────

  async leaveRoom(roomId: string, userId: string) {
    const room = await this.roomModel.findById(roomId);
    if (!room) throw AppException.notFound('Room not found');
    if (!room.members.includes(userId)) throw AppException.forbidden('Not a member');
    if (room.type === RoomType.DM) throw AppException.badRequest('Cannot leave a DM');

    room.members = room.members.filter((m) => m !== userId);
    await room.save();
    await this.cache.sRem(CacheKey.roomMembers(roomId), userId);
    return { roomId, userId };
  }

  // ── Membership check (used by message service) ────────────────────────────

  async isMember(roomId: string, userId: string): Promise<boolean> {
    // Fast path: Redis SET
    const inCache = await this.cache.sIsMember(CacheKey.roomMembers(roomId), userId);
    if (inCache) return true;

    // Cold path: DB + warm cache
    const room = await this.roomModel.findById(roomId).select('members').lean();
    if (!room) return false;
    if (room.members.includes(userId)) {
      await this.cache.sAdd(CacheKey.roomMembers(roomId), ...room.members);
      return true;
    }
    return false;
  }
}
