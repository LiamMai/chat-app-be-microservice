export enum Permission {
  // ── User management ──────────────────────────────────────────────────────
  USERS_READ        = 'users:read',
  USERS_WRITE       = 'users:write',
  USERS_DELETE      = 'users:delete',
  USERS_BAN         = 'users:ban',           // ban/unban users (ADMIN+)
  USERS_ROLE_ASSIGN = 'users:role:assign',   // change another user's role (SUPER_ADMIN only)

  // ── API key management (SUPER_ADMIN only) ────────────────────────────────
  API_KEY_CREATE = 'apikey:create',
  API_KEY_REVOKE = 'apikey:revoke',
  API_KEY_LIST   = 'apikey:list',

  // ── App configuration (SUPER_ADMIN only) ─────────────────────────────────
  APP_CONFIG_READ  = 'app:config:read',
  APP_CONFIG_WRITE = 'app:config:write',

  // ── Content moderation (ADMIN+) ──────────────────────────────────────────
  CONTENT_DELETE_ANY = 'content:delete:any',
  ROOMS_VIEW_ALL     = 'rooms:view:all',

  // ── Chat — every authenticated user ─────────────────────────────────────
  MESSAGES_READ  = 'messages:read',
  MESSAGES_WRITE = 'messages:write',
  ROOMS_CREATE   = 'rooms:create',
  ROOMS_JOIN     = 'rooms:join',
}
