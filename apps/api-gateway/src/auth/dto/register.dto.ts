import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '@app/common';

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'strongP@ssw0rd', minLength: 8 })
  password: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'strongP@ssw0rd' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  refreshToken: string;
}

export class CreateApiKeyDto {
  @ApiProperty({ example: 'My Integration Key' })
  name: string;

  @ApiProperty({ enum: Permission, isArray: true, example: [Permission.USERS_READ] })
  permissions: Permission[];

  @ApiProperty({ required: false, example: '2027-01-01T00:00:00.000Z', nullable: true })
  expiresAt?: string;
}
