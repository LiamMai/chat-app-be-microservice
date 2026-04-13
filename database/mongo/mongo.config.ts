// database/mongo/mongo.config.ts
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { appConfig } from 'src/config/configuration';

export const mongoConfig = (config: ConfigService): MongooseModuleOptions => ({
  uri: appConfig.mongo.uri,
  maxPoolSize: 20,
  retryWrites: true,
});
