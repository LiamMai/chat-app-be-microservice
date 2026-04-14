import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AUTH_PATTERNS } from '@app/common';
import { AuthService } from './auth.service';
import { ApiKeyService } from './api-key/api-key.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @MessagePattern(AUTH_PATTERNS.REGISTER)
  register(@Payload() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @MessagePattern(AUTH_PATTERNS.REFRESH)
  refresh(@Payload() { refreshToken }: { refreshToken: string }) {
    return this.authService.refresh(refreshToken);
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  logout(@Payload() { refreshToken }: { refreshToken: string }) {
    return this.authService.logout(refreshToken);
  }

  // API keys
  @MessagePattern(AUTH_PATTERNS.API_KEY_CREATE)
  createApiKey(@Payload() dto: CreateApiKeyDto) {
    return this.apiKeyService.create(dto);
  }

  @MessagePattern(AUTH_PATTERNS.API_KEY_VALIDATE)
  validateApiKey(@Payload() { key }: { key: string }) {
    return this.apiKeyService.validate(key);
  }

  @MessagePattern(AUTH_PATTERNS.API_KEY_LIST)
  listApiKeys(@Payload() { userId }: { userId: string }) {
    return this.apiKeyService.listByUser(userId);
  }

  @MessagePattern(AUTH_PATTERNS.API_KEY_REVOKE)
  revokeApiKey(@Payload() { keyId, userId }: { keyId: string; userId: string }) {
    return this.apiKeyService.revoke(keyId, userId);
  }
}
