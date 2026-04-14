import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SERVICES } from '@app/common';

@Injectable()
export class UsersService {
  constructor(
    @Inject(SERVICES.USERS) private readonly usersClient: ClientProxy,
  ) {}

  findAll() {
    return this.usersClient.send('users.findAll', {});
  }
}
