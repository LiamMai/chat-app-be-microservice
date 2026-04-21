/**
 * Centralised cache key factory.
 * All keys follow: <namespace>:<identifier>
 * Makes it easy to scan/delete by pattern.
 */
export const CacheKey = {
  // ── Auth ────────────────────────────────────────────────────────────────
  /** Blacklisted refresh token hash (set on logout, TTL = token remaining lifetime) */
  tokenBlacklist: (tokenHash: string) => `auth:blacklist:${tokenHash}`,

  /** API key validation result cache (avoids DB hit on every request) */
  apiKey: (keyHash: string) => `auth:apikey:${keyHash}`,

  // ── Users ───────────────────────────────────────────────────────────────
  user: (userId: string) => `user:${userId}`,
  userByEmail: (email: string) => `user:email:${email}`,

  // ── Rate limiting ────────────────────────────────────────────────────────
  /** Per-IP rate limit counter for a route */
  rateLimit: (ip: string, route: string) => `rate:${ip}:${route}`,

  /** Per-user rate limit counter (authenticated endpoints) */
  rateLimitUser: (userId: string, route: string) => `rate:user:${userId}:${route}`,

  // ── Presence (chat) ──────────────────────────────────────────────────────
  /** User online status — refreshed by client heartbeat (TTL 30 s) */
  presence: (userId: string) => `presence:${userId}`,

  // ── Rooms ────────────────────────────────────────────────────────────────
  /** Set of userIds in a room — fast membership check */
  roomMembers: (roomId: string) => `room:${roomId}:members`,

  /** Last N messages in a room — fast load on join (TTL 1 h) */
  recentMessages: (roomId: string) => `room:${roomId}:recent`,

  /** Set of userIds currently typing in a room (TTL per entry ~5 s) */
  typing: (roomId: string) => `room:${roomId}:typing`,

  /** Redis Pub/Sub channel for new messages in a room */
  roomChannel: (roomId: string) => `chat:room:${roomId}`,

  // ── Friends ──────────────────────────────────────────────────────────────
  /** Set of accepted friendIds for fast lookup */
  friendSet:       (userId: string) => `friends:set:${userId}`,
  /** Cached suggestion list (TTL 1h) */
  friendSuggestions: (userId: string) => `friends:suggestions:${userId}`,

  // ── Distributed locks ────────────────────────────────────────────────────
  lock: (resource: string) => `lock:${resource}`,
} as const;
