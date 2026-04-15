import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiGatewayModule } from './api-gateway.module';
import { appConfig, NodeEnv } from 'config/configuration';
import { AllExceptionsFilter, LoggingInterceptor, TransformInterceptor } from '@app/common';

async function bootstrap() {
  const isProd = appConfig.nodeEnv === NodeEnv.Production;

  const app = await NestFactory.create(ApiGatewayModule, {
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // ── Swagger ────────────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Chat App API')
    .setDescription('Chat App microservice API gateway')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-api-key' },
      'x-api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      // Auto-attach accessToken when login/register response contains one.
      // This function is serialized (.toString()) and executed in the browser —
      // globalThis.ui is the SwaggerUIBundle instance NestJS sets on the window.
      responseInterceptor: (res: any) => {
        const token = res?.body?.data?.accessToken;
        if (token) {
          (globalThis as any).ui?.authActions?.authorize({
            'access-token': {
              name: 'access-token',
              schema: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
              value: token,
            },
          });
        }
        return res;
      },
    },
  });
  // ──────────────────────────────────────────────────────────────────────────

  await app.listen(appConfig.port);

  const logger = new Logger('Bootstrap');
  logger.log(`API Gateway running on port ${appConfig.port}`);
  logger.log(`Swagger docs → http://localhost:${appConfig.port}/api/docs`);
  logger.debug(`Log level: ${isProd ? 'production' : 'debug'}`);
}
bootstrap();
