import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig } from 'config/configuration';
import { RedisModule } from '@app/common';
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
      synchronize: false, // auth service owns UserEntity schema; friends table created separately
    }),
    TypeOrmModule.forFeature([UserEntity, FriendEntity]),
    RedisModule.forRoot(),
  ],
  controllers: [UsersController, FriendController],
  providers: [UsersService, FriendService],
})
export class UsersModule {}
