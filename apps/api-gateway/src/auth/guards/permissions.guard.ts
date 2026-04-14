import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException, Permission, PERMISSIONS_KEY, RequestUser } from '@app/common';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const user: RequestUser = context.switchToHttp().getRequest().user;
    if (!user) throw AppException.forbidden('No user context');

    const isAdmin = user.permissions.includes(Permission.ADMIN);
    if (isAdmin) return true;

    const hasAll = required.every((p) => user.permissions.includes(p));
    if (!hasAll) throw AppException.forbidden('Insufficient permissions');

    return true;
  }
}
