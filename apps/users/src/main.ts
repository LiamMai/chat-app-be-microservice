import { NestFactory } from '@nestjs/core';
import { UsersModule } from './users.module';
import { Transport } from '@nestjs/microservices';
import { appConfig } from 'config/configuration';

async function bootstrap() {
      console.log("🚀 ~ bootstrap ~ appConfig.rabbitmq.url:", appConfig.rabbitmq.url)
  const app = await NestFactory.createMicroservice(UsersModule, {
    transport: Transport.RMQ,
    options: {
      urls: [appConfig.rabbitmq.url],
      queue: 'users_queue',
      queueOptions: {
        durable: false,
      },
    },
  });
  await app.listen();
}
bootstrap();
