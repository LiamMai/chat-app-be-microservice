import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig } from 'config/configuration';
import { RedisModule, RmqModule, SERVICES, QUEUES } from '@app/common';
import { migrations } from '../../../database/migrations';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEntity } from './entities/user.entity';
import { FriendEntity } from './entities/friend.entity';
import { FriendService } from './friends/friend.service';
import { FriendController } from './friends/friend.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: appConfig.postgres.host,
      port: appConfig.postgres.port,
      username: appConfig.postgres.username,
      password: appConfig.postgres.password,
      database: appConfig.postgres.database,
      entities: [UserEntity, FriendEntity],
      synchronize: false,
      migrations,
      migrationsRun: true,             // auto-run pending migrations on startup
      migrationsTableName: 'typeorm_migrations',
    }),
    TypeOrmModule.forFeature([UserEntity, FriendEntity]),
    RedisModule.forRoot(),
    RmqModule.register({ name: SERVICES.CHAT, queue: QUEUES[SERVICES.CHAT] }),
  ],
  controllers: [UsersController, FriendController],
  providers: [UsersService, FriendService],
})
export class UsersModule {}
