import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { appConfig } from 'src/config/configuration';

export const postgresConfig = (
  config: ConfigService,
): TypeOrmModuleOptions => ({
  name: 'postgres', 

  type: 'postgres',
  host: appConfig.postgres.host,
  port: appConfig.postgres.port,
  username: appConfig.postgres.username,
  password: appConfig.postgres.password,
  database: appConfig.postgres.database,
  autoLoadEntities: true,
  synchronize: false,

  logging: config.get('app.env') === 'development',

  // 🔥 production-ready settings
  extra: {
    max: 20, // connection pool
  },
});