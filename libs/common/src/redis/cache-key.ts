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
  /** User online status — refreshed by client heartbeat */
  presence: (userId: string) => `presence:${userId}`,

  // ── Rooms ────────────────────────────────────────────────────────────────
  roomMembers: (roomId: string) => `room:${roomId}:members`,

  // ── Distributed locks ────────────────────────────────────────────────────
  lock: (resource: string) => `lock:${resource}`,
} as const;
