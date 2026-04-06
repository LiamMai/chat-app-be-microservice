import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigModule } from '@nestjs/config';
import { appConfig, NodeEnv } from './config/configuration';

// somewhere in your initialization file
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [() => appConfig] })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  static async bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);
    app.enableShutdownHooks();
    app.use(helmet());

    const { port, nodeEnv, cors } = appConfig;

    if (cors.enable) {
      app.enableCors({
        origin: cors.origin,
        methods: cors.methods,
      });
    }

    if (nodeEnv !== NodeEnv.Production) {
      const swaggerConfig = new DocumentBuilder()
        .setTitle('NestJS Chat App Microservice API')
        .setDescription('NestJS Chat App Microservice API')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('api-docs', app, document, {
        swaggerOptions: {
          persistAuthorization: true,
          defaultModelsExpandDepth: -1,
        },
      });
    }

    await app.listen(port);
  }
}
