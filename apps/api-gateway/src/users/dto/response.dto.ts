import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@app/common';

export class UserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty() isActive: boolean;
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
