import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { CurrentUser, Public } from '@app/common';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  CreateApiKeyDto,
} from './dto/register.dto';
import {
  ApiKeyDto,
  AuthResponseDto,
  CreatedApiKeyDto,
  TokenPairDto,
  apiResponseSchema,
} from './dto/response.dto';

@ApiTags('Auth')
@ApiExtraModels(AuthResponseDto, TokenPairDto, CreatedApiKeyDto, ApiKeyDto)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiCreatedResponse(apiResponseSchema({ $ref: getSchemaPath(AuthResponseDto) }))
  @ApiConflictResponse({ description: 'Email already registered' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login with email + password' })
  @ApiOkResponse(apiResponseSchema({ $ref: getSchemaPath(AuthResponseDto) }))
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate token pair using refresh token' })
  @ApiOkResponse(apiResponseSchema({ $ref: getSchemaPath(TokenPairDto) }))
  @ApiUnauthorizedResponse({ description: 'Refresh token invalid or revoked' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke refresh token (logout)' })
  @ApiOkResponse({ description: 'Logged out' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('api-keys')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create API key' })
  @ApiCreatedResponse(apiResponseSchema({ $ref: getSchemaPath(CreatedApiKeyDto) }))
  createApiKey(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.authService.createApiKey({ userId, ...dto });
  }

  @UseGuards(JwtAuthGuard)
  @Get('api-keys')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List your API keys (raw key not returned)' })
  @ApiOkResponse(apiResponseSchema({ type: 'array', items: { $ref: getSchemaPath(ApiKeyDto) } }))
  listApiKeys(@CurrentUser('userId') userId: string) {
    return this.authService.listApiKeys(userId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('api-keys/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiNoContentResponse({ description: 'Key revoked' })
  revokeApiKey(@Param('id') keyId: string, @CurrentUser('userId') userId: string) {
    return this.authService.revokeApiKey(keyId, userId);
  }
}
