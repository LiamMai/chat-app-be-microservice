import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AppException,
  Permission,
  PERMISSIONS_KEY,
  RequestUser,
  Role,
  ROLES_KEY,
} from '@app/common';

/**
 * Combined role + permission guard.
 *
 * Usage (pick one or combine):
 *   @Roles(Role.ADMIN)                         — role check only
 *   @Permissions(Permission.USERS_BAN)         — permission check only
 *   @Roles(Role.ADMIN) @Permissions(...)       — role AND permission must match
 *
 * SUPER_ADMIN bypasses all checks.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No restrictions on this endpoint
    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const user: RequestUser = context.switchToHttp().getRequest().user;
    if (!user) throw AppException.forbidden('No user context');

    // SUPER_ADMIN bypasses everything
    if (user.role === Role.SUPER_ADMIN) return true;

    // Role check
    if (requiredRoles?.length) {
      const hasRole = requiredRoles.includes(user.role);
      if (!hasRole) throw AppException.forbidden('Insufficient role');
    }

    // Permission check
    if (requiredPermissions?.length) {
      const hasAll = requiredPermissions.every((p) => user.permissions.includes(p));
      if (!hasAll) throw AppException.forbidden('Insufficient permissions');
    }

    return true;
  }
}
