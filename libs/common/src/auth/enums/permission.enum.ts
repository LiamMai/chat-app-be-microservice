export enum Permission {
  // Users
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_DELETE = 'users:delete',

  // Messages
  MESSAGES_READ = 'messages:read',
  MESSAGES_WRITE = 'messages:write',

  // Rooms
  ROOMS_READ = 'rooms:read',
  ROOMS_WRITE = 'rooms:write',
  ROOMS_DELETE = 'rooms:delete',

  // Wildcard
  ADMIN = 'admin:*',
}
