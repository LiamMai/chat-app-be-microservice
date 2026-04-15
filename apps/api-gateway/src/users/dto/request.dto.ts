import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@app/common';

// PageQueryDto comes from @app/common — use it directly in controller via @Query()
export { PageQueryDto as FindAllQueryDto } from '@app/common';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}

export class BanUserDto {
  @ApiProperty({ example: true, description: 'true = ban, false = unban' })
  @IsBoolean()
  ban: boolean;
}

export class AssignRoleDto {
  @ApiProperty({ enum: [Role.ADMIN, Role.USER], description: 'Cannot assign SUPER_ADMIN via API' })
  @IsEnum([Role.ADMIN, Role.USER], { message: 'role must be admin or user' })
  role: Role.ADMIN | Role.USER;
}
