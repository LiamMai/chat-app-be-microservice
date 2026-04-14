import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Request } from 'express';
import { firstValueFrom, timeout } from 'rxjs';
import { AppException, AUTH_PATTERNS, RequestUser, SERVICES } from '@app/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(SERVICES.AUTH) private readonly authClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['x-api-key'] as string | undefined;

    if (!key) throw AppException.unauthorized('Missing x-api-key header');

    const result = await firstValueFrom<{ userId: string; permissions: RequestUser['permissions'] } | null>(
      this.authClient.send(AUTH_PATTERNS.API_KEY_VALIDATE, { key }).pipe(timeout(5000)),
    ).catch(() => {
      throw AppException.internal('Auth service unavailable');
    });

    if (!result) throw AppException.unauthorized('Invalid or revoked API key');

    const user: RequestUser = { userId: result.userId, email: '', permissions: result.permissions };
    (request as Request & { user: RequestUser }).user = user;

    return true;
  }
}
