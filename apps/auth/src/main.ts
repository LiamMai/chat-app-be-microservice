import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getRmqOptions, RpcExceptionFilter, SERVICES, QUEUES } from '@app/common';
import { appConfig, NodeEnv } from 'config/configuration';
import { AuthModule } from './auth.module';

async function bootstrap() {
  const isProd = appConfig.nodeEnv === NodeEnv.Production;

  const app = await NestFactory.createMicroservice(AuthModule, {
    ...getRmqOptions(QUEUES[SERVICES.AUTH]),
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.useGlobalFilters(new RpcExceptionFilter());
  await app.listen();

  new Logger('Bootstrap').log(`Auth microservice listening on queue: ${QUEUES[SERVICES.AUTH]}`);
}
bootstrap();
