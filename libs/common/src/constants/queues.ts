import { SERVICES } from './services';

export const QUEUES: Record<string, string> = {
  [SERVICES.USERS]: 'users_queue',
  [SERVICES.AUTH]:  'auth_queue',
  [SERVICES.CHAT]:  'chat_queue',
};
