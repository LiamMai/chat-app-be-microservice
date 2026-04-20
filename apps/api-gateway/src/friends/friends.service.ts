import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { AppException, PageQueryDto, SERVICES, USERS_PATTERNS } from '@app/common';

const RPC_TIMEOUT = 5000;

@Injectable()
export class FriendsService {
  constructor(
    @Inject(SERVICES.USERS) private readonly usersClient: ClientProxy,
  ) {}

  private async send<T>(pattern: string, payload: unknown): Promise<T> {
    try {
      return await firstValueFrom<T>(
        this.usersClient.send<T>(pattern, payload).pipe(timeout(RPC_TIMEOUT)),
      );
    } catch (err) {
      if ((err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'EmptyError') {
        throw AppException.internal('Users service unavailable');
      }
      throw err;
    }
  }

  sendRequest(userId: string, friendId: string) {
    return this.send(USERS_PATTERNS.FRIEND_REQUEST, { userId, friendId });
  }

  accept(userId: string, requesterId: string) {
    return this.send(USERS_PATTERNS.FRIEND_ACCEPT, { userId, requesterId });
  }

  decline(userId: string, requesterId: string) {
    return this.send(USERS_PATTERNS.FRIEND_DECLINE, { userId, requesterId });
  }

  unfriend(userId: string, friendId: string) {
    return this.send(USERS_PATTERNS.FRIEND_UNFRIEND, { userId, friendId });
  }

  block(userId: string, targetId: string) {
    return this.send(USERS_PATTERNS.FRIEND_BLOCK, { userId, targetId });
  }

  unblock(userId: string, targetId: string) {
    return this.send(USERS_PATTERNS.FRIEND_UNBLOCK, { userId, targetId });
  }

  listFriends(userId: string, query: PageQueryDto) {
    return this.send(USERS_PATTERNS.FRIEND_LIST, { userId, query });
  }

  listIncoming(userId: string, query: PageQueryDto) {
    return this.send(USERS_PATTERNS.FRIEND_REQUESTS_IN, { userId, query });
  }

  listOutgoing(userId: string, query: PageQueryDto) {
    return this.send(USERS_PATTERNS.FRIEND_REQUESTS_OUT, { userId, query });
  }

  getSuggestions(userId: string, query: PageQueryDto) {
    return this.send(USERS_PATTERNS.FRIEND_SUGGESTIONS, { userId, query });
  }

  getStatus(userId: string, targetId: string) {
    return this.send(USERS_PATTERNS.FRIEND_STATUS, { userId, targetId });
  }
}
