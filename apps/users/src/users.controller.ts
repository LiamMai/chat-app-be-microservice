import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { USERS_PATTERNS } from '@app/common';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(USERS_PATTERNS.FIND_ALL)
  findAll() {
    return this.usersService.findAll();
  }
}
