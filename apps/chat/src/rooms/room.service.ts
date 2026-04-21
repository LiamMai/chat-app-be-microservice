import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppException, CacheKey, CacheService, PageQueryDto, paginateMongo } from '@app/common';
import { Room, RoomDocument, RoomType } from '../entities/room.entity';

@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    private readonly cache: CacheService,
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

  // ── List rooms for a user ─────────────────────────────────────────────────

  listRooms(userId: string, query?: PageQueryDto) {
    return paginateMongo(this.roomModel, query, {
      filter: { members: userId as any }, 
      sort:   { updatedAt: -1 },
    });
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
