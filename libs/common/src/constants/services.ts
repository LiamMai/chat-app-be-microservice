export const SERVICES = {
  USERS: 'USERS_SERVICE',
  AUTH: 'AUTH_SERVICE',
  CHAT: 'CHAT_SERVICE',
} as const;

export type ServiceToken = (typeof SERVICES)[keyof typeof SERVICES];
