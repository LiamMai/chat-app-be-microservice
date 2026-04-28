import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RmqModule, SERVICES, QUEUES } from '@app/common';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    AuthModule,
    CloudinaryModule,
    RmqModule.register({ name: SERVICES.USERS, queue: QUEUES[SERVICES.USERS] }),
  ],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
