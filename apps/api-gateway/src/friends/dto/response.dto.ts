import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FriendUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() isActive: boolean;
}

export class FriendRequestDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() friendId: string;
  @ApiProperty({ enum: ['pending', 'accepted', 'declined', 'blocked'] })
  status: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class FriendStatusDto {
  @ApiPropertyOptional({
    enum: ['pending', 'accepted', 'declined', 'blocked'],
    nullable: true,
  })
  status: string | null;
}

export class RequesterUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiPropertyOptional({ nullable: true }) lastName: string | null;
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
  @ApiProperty() isActive: boolean;
}

export class IncomingFriendRequestDto {
  @ApiProperty() id: string;
  @ApiProperty() requesterId: string;
  @ApiProperty({ enum: ['pending', 'accepted', 'declined', 'blocked'] })
  status: string;
  @ApiProperty() createdAt: Date;
  @ApiPropertyOptional({ type: RequesterUserDto, nullable: true })
  requester: RequesterUserDto | null;
}
