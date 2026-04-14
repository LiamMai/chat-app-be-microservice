import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RmqModule, SERVICES, QUEUES } from '@app/common';
import { AuthService } from 'apps/auth/src/auth.service';
import { AuthModule } from 'apps/auth/src/auth.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    RmqModule.register({ name: SERVICES.USERS, queue: QUEUES[SERVICES.USERS] }),
    JwtModule
  ],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
