import { NestFactory } from '@nestjs/core';
import { UsersModule } from './users.module';
import { getRmqOptions, SERVICES, QUEUES } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(
    UsersModule,
    getRmqOptions(QUEUES[SERVICES.USERS]),
  );
  await app.listen();
}
bootstrap();
