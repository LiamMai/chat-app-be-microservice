import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { WsPlaygroundController } from './ws-playground.controller';
import { RmqModule, SERVICES, QUEUES, RedisModule } from '@app/common';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from '../users/users.service';

@Module({
  imports: [
    AuthModule, // provides JwtService + JwtAuthGuard
    RedisModule.forRoot(), // provides CacheService + REDIS_SUB_CLIENT
    RmqModule.register([
      { name: SERVICES.CHAT, queue: QUEUES[SERVICES.CHAT] },
      { name: SERVICES.USERS, queue: QUEUES[SERVICES.USERS] },
    ]),
  ],
  controllers: [ChatController, WsPlaygroundController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
