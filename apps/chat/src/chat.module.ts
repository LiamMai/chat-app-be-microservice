import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { appConfig } from 'config/configuration';
import { RedisModule, RmqModule, SERVICES, QUEUES } from '@app/common';
import { ChatController } from './chat.controller';
import { RoomService } from './rooms/room.service';
import { MessageService } from './messages/message.service';
import { MessageCrypto } from './messages/message-crypto';
import { Room, RoomSchema } from './entities/room.entity';
import { Message, MessageSchema } from './entities/message.entity';

@Module({
  imports: [
    MongooseModule.forRoot(appConfig.mongo.uri),
    MongooseModule.forFeature([
      { name: Room.name,    schema: RoomSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    RedisModule.forRoot(),
    RmqModule.register({ name: SERVICES.USERS, queue: QUEUES[SERVICES.USERS] }),
  ],
  controllers: [ChatController],
  providers: [RoomService, MessageService, MessageCrypto],
})
export class ChatModule {}
