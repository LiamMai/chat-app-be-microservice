import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, Role } from '@app/common';

export class UserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional() username: string | null;
  @ApiPropertyOptional() bio: string | null;
  @ApiPropertyOptional({ enum: Gender }) gender: Gender | null;
  @ApiPropertyOptional() birthdate: Date | null;
  @ApiPropertyOptional() location: string | null;
  @ApiPropertyOptional() website: string | null;
  @ApiPropertyOptional() avatarUrl: string | null;
  @ApiPropertyOptional() coverUrl: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserDto] }) data: UserDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}
