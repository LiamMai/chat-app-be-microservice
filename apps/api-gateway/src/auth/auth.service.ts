import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AUTH_PATTERNS, SERVICES } from '@app/common';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SERVICES.AUTH) private readonly authClient: ClientProxy,
  ) {}

  register(dto: { email: string; password: string; name: string }) {
    return firstValueFrom(this.authClient.send(AUTH_PATTERNS.REGISTER, dto));
  }

  login(dto: { email: string; password: string }) {
    return firstValueFrom(this.authClient.send(AUTH_PATTERNS.LOGIN, dto));
  }

  refresh(refreshToken: string) {
    return firstValueFrom(this.authClient.send(AUTH_PATTERNS.REFRESH, { refreshToken }));
  }

  logout(refreshToken: string) {
    return firstValueFrom(this.authClient.send(AUTH_PATTERNS.LOGOUT, { refreshToken }));
  }

  createApiKey(dto: { userId: string; name: string; permissions: string[]; expiresAt?: string }) {
    return firstValueFrom(this.authClient.send(AUTH_PATTERNS.API_KEY_CREATE, dto));
  }

  listApiKeys(userId: string) {
    return firstValueFrom(this.authClient.send(AUTH_PATTERNS.API_KEY_LIST, { userId }));
  }

  revokeApiKey(keyId: string, userId: string) {
    return firstValueFrom(this.authClient.send(AUTH_PATTERNS.API_KEY_REVOKE, { keyId, userId }));
  }
}
