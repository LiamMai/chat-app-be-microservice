export const AUTH_PATTERNS = {
  REGISTER: 'auth.register',
  LOGIN: 'auth.login',
  REFRESH: 'auth.refresh',
  LOGOUT: 'auth.logout',
  API_KEY_CREATE: 'auth.apiKey.create',
  API_KEY_VALIDATE: 'auth.apiKey.validate',
  API_KEY_LIST: 'auth.apiKey.list',
  API_KEY_REVOKE: 'auth.apiKey.revoke',
} as const;
