import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RmqModule, SERVICES, QUEUES } from '@app/common';

@Module({
  imports: [
    RmqModule.register({ name: SERVICES.USERS, queue: QUEUES[SERVICES.USERS] }),
  ],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
