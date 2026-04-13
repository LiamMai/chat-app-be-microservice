import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';
import { appConfig } from 'config/configuration';

async function bootstrap() {
  console.log('🚀 ~ appConfig.rabbitmq.url:', appConfig.rabbitmq.url);
  const app = await NestFactory.create(ApiGatewayModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
