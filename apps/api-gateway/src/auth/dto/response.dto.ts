import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '@app/common';

export class UserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: Permission, isArray: true }) permissions: Permission[];
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class TokenPairDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
}

export class AuthResponseDto extends TokenPairDto {
  @ApiProperty({ type: UserDto }) user: UserDto;
}

export class ApiKeyDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ description: 'First 12 chars — use to identify key in UI' }) prefix: string;
  @ApiProperty({ enum: Permission, isArray: true }) permissions: Permission[];
  @ApiProperty({ nullable: true }) expiresAt: Date | null;
  @ApiProperty({ nullable: true }) lastUsedAt: Date | null;
  @ApiProperty() createdAt: Date;
}

export class CreatedApiKeyDto {
  @ApiProperty({ type: ApiKeyDto }) apiKey: ApiKeyDto;
  @ApiProperty({ description: 'Raw key — shown ONCE, store securely' }) rawKey: string;
}

/** Generic ApiResponse<T> wrapper schema for Swagger */
export function apiResponseSchema(dataSchema: object) {
  return {
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Success' },
        data: dataSchema,
        error: { type: 'string', nullable: true, example: null },
        timestamp: { type: 'string', example: '2026-04-14T00:00:00.000Z' },
      },
    },
  };
}
