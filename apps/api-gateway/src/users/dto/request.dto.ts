import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Gender, PageQueryDto, Role } from '@app/common';

export { PageQueryDto as FindAllQueryDto } from '@app/common';

export class SearchUsersQueryDto extends PageQueryDto {
  @ApiProperty({ example: 'john', description: 'Search by name, email, or username (partial, case-insensitive)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ example: 'johndoe', description: 'Unique handle — lowercase letters, numbers, underscores' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9_]+$/, { message: 'username may only contain lowercase letters, numbers, and underscores' })
  username?: string;

  @ApiPropertyOptional({ example: 'Building cool things.', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '1995-06-15', description: 'ISO date string YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City, Vietnam' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @ValidateIf((o) => o.website !== undefined && o.website.length > 0)
  @IsUrl()
  @MaxLength(255)
  website?: string;
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
