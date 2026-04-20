import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PageQueryDto, USERS_PATTERNS } from '@app/common';
import { FriendService } from './friend.service';

@Controller()
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  @MessagePattern(USERS_PATTERNS.FRIEND_REQUEST)
  sendRequest(@Payload() { userId, friendId }: { userId: string; friendId: string }) {
    return this.friendService.sendRequest(userId, friendId);
  }

  @MessagePattern(USERS_PATTERNS.FRIEND_ACCEPT)
  accept(@Payload() { userId, requesterId }: { userId: string; requesterId: string }) {
    return this.friendService.accept(userId, requesterId);
  }

  @MessagePattern(USERS_PATTERNS.FRIEND_DECLINE)
  decline(@Payload() { userId, requesterId }: { userId: string; requesterId: string }) {
    return this.friendService.decline(userId, requesterId);
  }

  @MessagePattern(USERS_PATTERNS.FRIEND_UNFRIEND)
  unfriend(@Payload() { userId, friendId }: { userId: string; friendId: string }) {
    return this.friendService.unfriend(userId, friendId);
  }

  @MessagePattern(USERS_PATTERNS.FRIEND_BLOCK)
  block(@Payload() { userId, targetId }: { userId: string; targetId: string }) {
    return this.friendService.block(userId, targetId);
  }

  @MessagePattern(USERS_PATTERNS.FRIEND_UNBLOCK)
  unblock(@Payload() { userId, targetId }: { userId: string; targetId: string }) {
    return this.friendService.unblock(userId, targetId);
  }

  @MessagePattern(USERS_PATTERNS.FRIEND_LIST)
  listFriends(@Payload() { userId, query }: { userId: string; query: PageQueryDto }) {
    return this.friendService.listFriends(userId, query);
  }

  @MessagePattern(USERS_PATTERNS.FRIEND_REQUESTS_IN)
  listIncoming(@Payload() { userId, query }: { userId: string; query: PageQueryDto }) {
    return this.friendService.listIncoming(userId, query);
  }

  @MessagePattern(USERS_PATTERNS.FRIEND_REQUESTS_OUT)
  listOutgoing(@Payload() { userId, query }: { userId: string; query: PageQueryDto }) {
    return this.friendService.listOutgoing(userId, query);
  }

  @MessagePattern(USERS_PATTERNS.FRIEND_SUGGESTIONS)
  getSuggestions(@Payload() { userId, query = {} }: { userId: string; query?: PageQueryDto }) {
    return this.friendService.getSuggestions(userId, query as PageQueryDto);
  }

  @MessagePattern(USERS_PATTERNS.FRIEND_STATUS)
  getStatus(@Payload() { userId, targetId }: { userId: string; targetId: string }) {
    return this.friendService.getStatus(userId, targetId);
  }
}
