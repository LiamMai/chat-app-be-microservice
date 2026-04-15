import { Role } from './role.enum';
import { Permission } from './permission.enum';

/**
 * Canonical mapping: Role → permissions granted.
 * JWT embeds this at sign-time so guards never hit the DB.
 * When permissions change here, users must re-login to get updated tokens.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.SUPER_ADMIN]: Object.values(Permission), // full access

  [Role.ADMIN]: [
    Permission.USERS_READ,
    Permission.USERS_BAN,
    Permission.CONTENT_DELETE_ANY,
    Permission.ROOMS_VIEW_ALL,
    Permission.MESSAGES_READ,
    Permission.MESSAGES_WRITE,
    Permission.ROOMS_CREATE,
    Permission.ROOMS_JOIN,
  ],

  [Role.USER]: [
    Permission.MESSAGES_READ,
    Permission.MESSAGES_WRITE,
    Permission.ROOMS_CREATE,
    Permission.ROOMS_JOIN,
  ],
};
