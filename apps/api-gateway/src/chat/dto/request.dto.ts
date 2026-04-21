import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '@app/common';

export enum RoomTypeDto { DM = 'dm', GROUP = 'group' }

export class CreateRoomDto {
  @ApiProperty({ enum: RoomTypeDto })
  @IsEnum(RoomTypeDto)
  type: RoomTypeDto;

  @ApiPropertyOptional({ example: 'Team Alpha' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ type: [String], example: ['uuid-1', 'uuid-2'] })
  @IsString({ each: true })
  members: string[];
}

export class SendMessageDto {
  @ApiProperty({ example: 'Hello world' })
  @IsString()
  @MaxLength(4000)
  content: string;
}

export class AddMemberDto {
  @ApiProperty()
  @IsString()
  targetUserId: string;
}

export class MessageHistoryQueryDto extends PageQueryDto {}
