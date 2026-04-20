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
  @ApiProperty({ enum: ['pending', 'accepted', 'declined', 'blocked'] }) status: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class FriendStatusDto {
  @ApiPropertyOptional({ enum: ['pending', 'accepted', 'declined', 'blocked'], nullable: true })
  status: string | null;
}
