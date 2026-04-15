import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { AppException, SERVICES, USERS_PATTERNS } from '@app/common';
import { FindAllQueryDto, UpdateProfileDto, BanUserDto, AssignRoleDto } from './dto/request.dto';

const RPC_TIMEOUT = 5000;

@Injectable()
export class UsersService {
  constructor(
    @Inject(SERVICES.USERS) private readonly usersClient: ClientProxy,
  ) {}

  private async send<T>(pattern: string, payload: unknown): Promise<T> {
    try {
      return await firstValueFrom<T>(
        this.usersClient.send<T>(pattern, payload).pipe(timeout(RPC_TIMEOUT)),
      );
    } catch (err) {
      // TimeoutError or connection failure → 503
      if ((err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'EmptyError') {
        throw AppException.internal('Users service unavailable');
      }
      // RPC business error (403, 404, etc.) — re-throw so AllExceptionsFilter handles it
      throw err;
    }
  }

  findAll(query: FindAllQueryDto) {
    return this.send(USERS_PATTERNS.FIND_ALL, query);
  }

  findById(id: string) {
    return this.send(USERS_PATTERNS.FIND_BY_ID, { id });
  }

  updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.send(USERS_PATTERNS.UPDATE_PROFILE, { userId, ...dto });
  }

  banUser(targetUserId: string, requesterId: string, dto: BanUserDto) {
    return this.send(USERS_PATTERNS.BAN_USER, { targetUserId, requesterId, ban: dto.ban });
  }

  assignRole(targetUserId: string, requesterId: string, dto: AssignRoleDto) {
    return this.send(USERS_PATTERNS.ASSIGN_ROLE, { targetUserId, requesterId, role: dto.role });
  }
}
