import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiTags,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, apiPaginatedSchema } from '@app/common';
import { FriendPageQueryDto } from './dto/request.dto';
import {
  FriendRequestDto,
  FriendStatusDto,
  FriendUserDto,
  IncomingFriendRequestDto,
} from './dto/response.dto';

@ApiTags('Friends')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@ApiExtraModels(
  FriendUserDto,
  FriendRequestDto,
  FriendStatusDto,
  IncomingFriendRequestDto,
)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  // ── Suggestions ──────────────────────────────────────────────────────────

  @Get('suggestions')
  @ApiOperation({
    summary: 'Get friend suggestions (mutual friends + new users, paginated)',
  })
  @ApiOkResponse(apiPaginatedSchema({ $ref: getSchemaPath(FriendUserDto) }))
  getSuggestions(
    @CurrentUser('userId') userId: string,
    @Query() query: FriendPageQueryDto,
  ) {
    return this.friendsService.getSuggestions(userId, query);
  }

  // ── My friend list ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List accepted friends (paginated)' })
  @ApiOkResponse(apiPaginatedSchema({ $ref: getSchemaPath(FriendUserDto) }))
  listFriends(
    @CurrentUser('userId') userId: string,
    @Query() query: FriendPageQueryDto,
  ) {
    return this.friendsService.listFriends(userId, query);
  }

  // ── Requests ──────────────────────────────────────────────────────────────

  @Get('requests/incoming')
  @ApiOperation({ summary: 'List incoming pending friend requests' })
  @ApiOkResponse(
    apiPaginatedSchema({ $ref: getSchemaPath(IncomingFriendRequestDto) }),
  )
  listIncoming(
    @CurrentUser('userId') userId: string,
    @Query() query: FriendPageQueryDto,
  ) {
    return this.friendsService.listIncoming(userId, query);
  }

  @Get('requests/outgoing')
  @ApiOperation({ summary: 'List outgoing pending friend requests' })
  @ApiOkResponse(apiPaginatedSchema({ $ref: getSchemaPath(FriendRequestDto) }))
  listOutgoing(
    @CurrentUser('userId') userId: string,
    @Query() query: FriendPageQueryDto,
  ) {
    return this.friendsService.listOutgoing(userId, query);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  @Get(':userId/status')
  @ApiOperation({ summary: 'Get friend status with a specific user' })
  @ApiOkResponse({ type: FriendStatusDto })
  getStatus(
    @CurrentUser('userId') userId: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    return this.friendsService.getStatus(userId, targetId);
  }

  // ── Send request ──────────────────────────────────────────────────────────

  @Post(':userId/request')
  @ApiOperation({ summary: 'Send friend request' })
  @ApiCreatedResponse({ type: FriendRequestDto })
  sendRequest(
    @CurrentUser('userId') userId: string,
    @Param('userId', ParseUUIDPipe) friendId: string,
  ) {
    return this.friendsService.sendRequest(userId, friendId);
  }

  // ── Accept / Decline ──────────────────────────────────────────────────────

  @Patch(':userId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept friend request' })
  @ApiOkResponse({ type: FriendRequestDto })
  accept(
    @CurrentUser('userId') userId: string,
    @Param('userId', ParseUUIDPipe) requesterId: string,
  ) {
    return this.friendsService.accept(userId, requesterId);
  }

  @Patch(':userId/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline friend request' })
  @ApiOkResponse({ type: FriendRequestDto })
  decline(
    @CurrentUser('userId') userId: string,
    @Param('userId', ParseUUIDPipe) requesterId: string,
  ) {
    return this.friendsService.decline(userId, requesterId);
  }

  // ── Unfriend ──────────────────────────────────────────────────────────────

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfriend a user' })
  @ApiNoContentResponse({ description: 'Unfriended' })
  unfriend(
    @CurrentUser('userId') userId: string,
    @Param('userId', ParseUUIDPipe) friendId: string,
  ) {
    return this.friendsService.unfriend(userId, friendId);
  }

  // ── Block / Unblock ───────────────────────────────────────────────────────

  @Post(':userId/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Block a user' })
  @ApiOkResponse({ description: 'User blocked' })
  block(
    @CurrentUser('userId') userId: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    return this.friendsService.block(userId, targetId);
  }

  @Delete(':userId/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiNoContentResponse({ description: 'Unblocked' })
  unblock(
    @CurrentUser('userId') userId: string,
    @Param('userId', ParseUUIDPipe) targetId: string,
  ) {
    return this.friendsService.unblock(userId, targetId);
  }
}
