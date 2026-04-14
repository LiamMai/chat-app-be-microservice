export const SERVICES = {
  USERS: 'USERS_SERVICE',
  AUTH: 'AUTH_SERVICE',
  MESSAGES: 'MESSAGES_SERVICE',
  ROOMS: 'ROOMS_SERVICE',
} as const;

export type ServiceToken = (typeof SERVICES)[keyof typeof SERVICES];
