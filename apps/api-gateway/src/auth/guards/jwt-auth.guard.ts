import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppException, IS_PUBLIC_KEY, JwtPayload, RequestUser } from '@app/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) throw AppException.unauthorized('Missing bearer token');

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw AppException.unauthorized('Invalid or expired token');
    }

    if (payload.type !== 'access') {
      throw AppException.unauthorized('Invalid token type');
    }

    const user: RequestUser = {
      userId: payload.sub,
      email: payload.email,
      permissions: payload.permissions,
    };
    (request as Request & { user: RequestUser }).user = user;

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }
}
