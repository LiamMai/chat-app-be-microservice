import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { AppException, CacheKey, CacheService, PageQueryDto, paginate, paginateCachedList, Role } from '@app/common';
import { FriendEntity, FriendStatus } from '../entities/friend.entity';
import { UserEntity } from '../entities/user.entity';

const SUGGESTION_TTL   = 3600; // 1 hour
const SUGGESTION_POOL  = 200;  // max IDs stored in Redis list

@Injectable()
export class FriendService {
  constructor(
    @InjectRepository(FriendEntity)
    private readonly friendRepo: Repository<FriendEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly cache: CacheService,
  ) {}

  // ── Send request ─────────────────────────────────────────────────────────

  async sendRequest(userId: string, friendId: string) {
    if (userId === friendId) throw AppException.badRequest('Cannot add yourself');

    // Fetch both users to check roles
    const [requester, target] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId },   select: ['id', 'role'] }),
      this.userRepo.findOne({ where: { id: friendId }, select: ['id', 'role'] }),
    ]);

    if (!target) throw AppException.notFound('User not found');

    // SUPER_ADMIN is a platform operator — not a chat participant
    if (target.role === Role.SUPER_ADMIN) {
      throw AppException.forbidden('Cannot send friend request to a super admin');
    }
    if (requester?.role === Role.SUPER_ADMIN) {
      throw AppException.forbidden('Super admins cannot send friend requests');
    }

    // Check if blocker blocked us or we blocked them
    const blocked = await this.friendRepo.findOne({
      where: [
        { userId, friendId, status: FriendStatus.BLOCKED },
        { userId: friendId, friendId: userId, status: FriendStatus.BLOCKED },
      ],
    });
    if (blocked) throw AppException.forbidden('Action not allowed');

    const existing = await this.friendRepo.findOne({
      where: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    });

    if (existing) {
      if (existing.status === FriendStatus.ACCEPTED) throw AppException.conflict('Already friends');
      if (existing.status === FriendStatus.PENDING)  throw AppException.conflict('Request already pending');
      // Declined → allow re-request: update row
      if (existing.status === FriendStatus.DECLINED) {
        existing.userId   = userId;
        existing.friendId = friendId;
        existing.status   = FriendStatus.PENDING;
        return this.friendRepo.save(existing);
      }
    }

    return this.friendRepo.save(this.friendRepo.create({ userId, friendId, status: FriendStatus.PENDING }));
  }

  // ── Accept ────────────────────────────────────────────────────────────────

  async accept(userId: string, requesterId: string) {
    const request = await this.friendRepo.findOne({
      where: { userId: requesterId, friendId: userId, status: FriendStatus.PENDING },
    });
    if (!request) throw AppException.notFound('Friend request not found');

    request.status = FriendStatus.ACCEPTED;
    await this.friendRepo.save(request);

    // Update Redis friend sets for both users
    await Promise.all([
      this.cache.sAdd(CacheKey.friendSet(userId), requesterId),
      this.cache.sAdd(CacheKey.friendSet(requesterId), userId),
      // Invalidate suggestion caches
      this.cache.del(CacheKey.friendSuggestions(userId)),
      this.cache.del(CacheKey.friendSuggestions(requesterId)),
    ]);

    return request;
  }

  // ── Decline ───────────────────────────────────────────────────────────────

  async decline(userId: string, requesterId: string) {
    const request = await this.friendRepo.findOne({
      where: { userId: requesterId, friendId: userId, status: FriendStatus.PENDING },
    });
    if (!request) throw AppException.notFound('Friend request not found');

    request.status = FriendStatus.DECLINED;
    return this.friendRepo.save(request);
  }

  // ── Unfriend ──────────────────────────────────────────────────────────────

  async unfriend(userId: string, friendId: string) {
    const relation = await this.friendRepo.findOne({
      where: [
        { userId, friendId, status: FriendStatus.ACCEPTED },
        { userId: friendId, friendId: userId, status: FriendStatus.ACCEPTED },
      ],
    });
    if (!relation) throw AppException.notFound('Friendship not found');

    await this.friendRepo.remove(relation);

    await Promise.all([
      this.cache.sRem(CacheKey.friendSet(userId), friendId),
      this.cache.sRem(CacheKey.friendSet(friendId), userId),
      this.cache.del(CacheKey.friendSuggestions(userId)),
      this.cache.del(CacheKey.friendSuggestions(friendId)),
    ]);
  }

  // ── Block ─────────────────────────────────────────────────────────────────

  async block(userId: string, targetId: string) {
    if (userId === targetId) throw AppException.badRequest('Cannot block yourself');

    // Remove friendship if exists
    const existing = await this.friendRepo.findOne({
      where: [
        { userId, friendId: targetId },
        { userId: targetId, friendId: userId },
      ],
    });

    if (existing) {
      if (existing.status === FriendStatus.BLOCKED && existing.userId === userId) {
        throw AppException.conflict('Already blocked');
      }
      // Reuse row — set blocker as userId
      existing.userId   = userId;
      existing.friendId = targetId;
      existing.status   = FriendStatus.BLOCKED;
      await this.friendRepo.save(existing);
    } else {
      await this.friendRepo.save(
        this.friendRepo.create({ userId, friendId: targetId, status: FriendStatus.BLOCKED }),
      );
    }

    // Clean Redis
    await Promise.all([
      this.cache.sRem(CacheKey.friendSet(userId), targetId),
      this.cache.sRem(CacheKey.friendSet(targetId), userId),
    ]);
  }

  // ── Unblock ───────────────────────────────────────────────────────────────

  async unblock(userId: string, targetId: string) {
    const relation = await this.friendRepo.findOne({
      where: { userId, friendId: targetId, status: FriendStatus.BLOCKED },
    });
    if (!relation) throw AppException.notFound('Block not found');
    await this.friendRepo.remove(relation);
  }

  // ── List friends ──────────────────────────────────────────────────────────

  async listFriends(userId: string, query: PageQueryDto) {
    const qb = this.friendRepo
      .createQueryBuilder('f')
      .where(
        '(f.userId = :uid AND f.status = :status) OR (f.friendId = :uid AND f.status = :status)',
        { uid: userId, status: FriendStatus.ACCEPTED },
      )
      .orderBy('f.updatedAt', 'DESC');

    const page  = Math.max(1, query.page  ?? 1);
    const limit = Math.min(query.limit ?? 20, 100);
    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    // Resolve user info for the "other" side
    const friendIds = data.map((f) => (f.userId === userId ? f.friendId : f.userId));
    const users = await this.userRepo.find({
      where: { id: In(friendIds) },
      select: ['id', 'email', 'name', 'isActive'],
    });

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasPrevPage: page > 1,
        hasNextPage: page < Math.ceil(total / limit),
      },
    };
  }

  // ── Incoming requests ─────────────────────────────────────────────────────

  listIncoming(userId: string, query: PageQueryDto) {
    return paginate(this.friendRepo, query, {
      where: { friendId: userId, status: FriendStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Outgoing requests ─────────────────────────────────────────────────────

  listOutgoing(userId: string, query: PageQueryDto) {
    return paginate(this.friendRepo, query, {
      where: { userId, status: FriendStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Friend status between two users ──────────────────────────────────────

  async getStatus(userId: string, targetId: string) {
    const relation = await this.friendRepo.findOne({
      where: [
        { userId, friendId: targetId },
        { userId: targetId, friendId: userId },
      ],
    });
    return { status: relation?.status ?? null };
  }

  // ── Suggestions (mutual friends + fallback, paginated via Redis list) ──────

  getSuggestions(userId: string, query: PageQueryDto) {
    return paginateCachedList<UserEntity>(this.cache, query, {
      cacheKey: CacheKey.friendSuggestions(userId),
      ttl: SUGGESTION_TTL,
      fetchIds: () => this.buildSuggestionIds(userId),
      fetchItems: (ids) =>
        this.userRepo.find({
          where: { id: In(ids) },
          select: ['id', 'email', 'name', 'isActive'],
        }),
    });
  }

  private async buildSuggestionIds(userId: string): Promise<string[]> {
    // Step 1: mutual-friends ranked by mutual count
    const mutuals = await this.dataSource.query<{ suggested_user_id: string }[]>(
      `
      SELECT f2."friendId" AS suggested_user_id
      FROM   friends f1
      JOIN   friends f2
             ON  f2."userId" = f1."friendId"
             AND f2.status   = 'accepted'
      WHERE  f1."userId"   = $1
        AND  f1.status     = 'accepted'
        AND  f2."friendId" != $1
        AND  f2."friendId" NOT IN (
               SELECT "friendId" FROM friends WHERE "userId"   = $1
               UNION
               SELECT "userId"   FROM friends WHERE "friendId" = $1
             )
      GROUP  BY f2."friendId"
      ORDER  BY COUNT(*) DESC
      LIMIT  $2
      `,
      [userId, SUGGESTION_POOL],
    );

    const mutualIds = mutuals.map((r) => r.suggested_user_id);

    // Step 2: fallback — newest non-connected active non-super-admin users
    const remaining = SUGGESTION_POOL - mutualIds.length;
    let fallbackIds: string[] = [];

    if (remaining > 0) {
      const fallback = await this.dataSource.query<{ id: string }[]>(
        `
        SELECT id FROM auth_users
        WHERE  id != $1
          AND  "isActive" = true
          AND  role != 'super_admin'
          AND  id NOT IN (
                 SELECT "friendId" FROM friends WHERE "userId"   = $1
                 UNION
                 SELECT "userId"   FROM friends WHERE "friendId" = $1
               )
          ${mutualIds.length ? `AND id NOT IN (${mutualIds.map((_, i) => `$${i + 3}`).join(',')})` : ''}
        ORDER  BY "createdAt" DESC
        LIMIT  $2
        `,
        [userId, remaining, ...mutualIds],
      );
      fallbackIds = fallback.map((r) => r.id);
    }

    return [...mutualIds, ...fallbackIds];
  }
}
