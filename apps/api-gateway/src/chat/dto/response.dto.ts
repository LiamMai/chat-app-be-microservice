import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoomMemberDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
}

export class RoomDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['dm', 'group'] }) type: string;
  @ApiPropertyOptional({ nullable: true }) name: string | null;
  @ApiProperty({ type: [String] }) members: string[];
  @ApiProperty() createdBy: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class MessageDto {
  @ApiProperty() id: string;
  @ApiProperty() roomId: string;
  @ApiProperty() senderId: string;
  @ApiProperty({ enum: ['text', 'image', 'file'] }) type: string;
  @ApiProperty() content: string;
  @ApiProperty({ type: [String] }) readBy: string[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
