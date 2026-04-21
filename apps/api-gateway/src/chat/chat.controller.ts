import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, apiOkSchema, apiPaginatedSchema, apiCreatedSchema } from '@app/common';
import { AddMemberDto, CreateRoomDto, MessageHistoryQueryDto, SendMessageDto } from './dto/request.dto';
import { MessageDto, RoomDto } from './dto/response.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@ApiExtraModels(RoomDto, MessageDto)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ── Rooms ─────────────────────────────────────────────────────────────────

  @Post('rooms')
  @ApiOperation({ summary: 'Create a DM or group room' })
  @ApiCreatedResponse(apiCreatedSchema({ $ref: getSchemaPath(RoomDto) }))
  createRoom(@CurrentUser('userId') userId: string, @Body() dto: CreateRoomDto) {
    return this.chatService.createRoom(userId, dto);
  }

  @Get('rooms')
  @ApiOperation({ summary: 'List rooms the current user belongs to (paginated)' })
  @ApiOkResponse(apiPaginatedSchema({ $ref: getSchemaPath(RoomDto) }))
  listRooms(
    @CurrentUser('userId') userId: string,
    @Query() query: MessageHistoryQueryDto,
  ) {
    return this.chatService.listRooms(userId, query);
  }

  @Get('rooms/:roomId')
  @ApiOperation({ summary: 'Get a single room' })
  @ApiOkResponse(apiOkSchema({ $ref: getSchemaPath(RoomDto) }))
  getRoom(
    @Param('roomId') roomId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.getRoom(roomId, userId);
  }

  @Post('rooms/:roomId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a member to a group room' })
  @ApiOkResponse(apiOkSchema({ $ref: getSchemaPath(RoomDto) }))
  addMember(
    @Param('roomId') roomId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.chatService.addMember(roomId, userId, dto.targetUserId);
  }

  @Delete('rooms/:roomId/members/me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a group room' })
  @ApiNoContentResponse({ description: 'Left room' })
  leaveRoom(
    @Param('roomId') roomId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.leaveRoom(roomId, userId);
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  @Post('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Send a text message (REST fallback — prefer WebSocket)' })
  @ApiCreatedResponse(apiCreatedSchema({ $ref: getSchemaPath(MessageDto) }))
  sendMessage(
    @Param('roomId') roomId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(userId, roomId, dto.content);
  }

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Get message history (paginated, newest first)' })
  @ApiOkResponse(apiPaginatedSchema({ $ref: getSchemaPath(MessageDto) }))
  getHistory(
    @Param('roomId') roomId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: MessageHistoryQueryDto,
  ) {
    return this.chatService.getHistory(roomId, userId, query);
  }

  @Patch('rooms/:roomId/messages/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all messages in a room as read' })
  @ApiOkResponse({ description: '{ roomId, userId }' })
  markRead(
    @Param('roomId') roomId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.chatService.markRead(roomId, userId);
  }
}
