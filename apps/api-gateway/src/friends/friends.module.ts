import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { AuthModule } from '../auth/auth.module';
import { RmqModule, SERVICES, QUEUES } from '@app/common';

@Module({
  imports: [
    AuthModule,
    RmqModule.register({ name: SERVICES.USERS, queue: QUEUES[SERVICES.USERS] }),
  ],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}
