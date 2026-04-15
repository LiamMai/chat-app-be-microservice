import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ── Basic get/set/del ────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    const val = await this.redis.get(key);
    if (val === null) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.redis.setex(key, ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async del(...keys: string[]): Promise<number> {
    if (!keys.length) return 0;
    return this.redis.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.redis.exists(key)) > 0;
  }

  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(key, ttlSeconds);
  }

  // ── Cache-aside ──────────────────────────────────────────────────────────

  /**
   * Get from cache; if missing, call `fn`, cache the result, then return it.
   * Standard cache-aside (lazy-loading) pattern.
   */
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /** Delete all keys matching a glob pattern. Use carefully on large datasets. */
  async deleteByPattern(pattern: string): Promise<number> {
    const keys = await this.redis.keys(pattern);
    if (!keys.length) return 0;
    return this.redis.del(...keys);
  }

  // ── Counters (rate limiting) ─────────────────────────────────────────────

  /**
   * Increment counter; set TTL on first increment (atomic via pipeline).
   * Returns current count after increment.
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (ttlSeconds) {
      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.expire(key, ttlSeconds, 'NX'); // only set TTL if not already set
      const results = await pipeline.exec();
      return (results?.[0]?.[1] as number) ?? 0;
    }
    return this.redis.incr(key);
  }

  /** Decrement counter. */
  async decr(key: string): Promise<number> {
    return this.redis.decr(key);
  }

  // ── Distributed lock ─────────────────────────────────────────────────────

  /**
   * Acquire lock (SET NX EX). Returns true if acquired, false if already locked.
   * @param value - unique caller ID to allow safe release
   */
  async acquireLock(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Release lock only if owned by caller (atomic Lua script).
   * Prevents releasing another caller's lock.
   */
  async releaseLock(key: string, value: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, key, value);
    return result === 1;
  }

  // ── Sets (presence, room members) ───────────────────────────────────────

  async sAdd(key: string, ...members: string[]): Promise<number> {
    return this.redis.sadd(key, ...members);
  }

  async sRem(key: string, ...members: string[]): Promise<number> {
    return this.redis.srem(key, ...members);
  }

  async sMembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  async sIsMember(key: string, member: string): Promise<boolean> {
    return (await this.redis.sismember(key, member)) === 1;
  }

  async sCard(key: string): Promise<number> {
    return this.redis.scard(key);
  }

  // ── Pub/Sub helpers ──────────────────────────────────────────────────────

  async publish(channel: string, message: unknown): Promise<number> {
    return this.redis.publish(channel, JSON.stringify(message));
  }

  // ── Health ───────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch (err) {
      this.logger.error('Redis ping failed', err);
      return false;
    }
  }
}
