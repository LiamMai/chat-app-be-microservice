import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { appConfig } from '../config/configuration';
import { migrations } from './migrations';

// Canonical source: users service entity (full schema with profile fields).
// Auth service also has UserEntity but it points to the same table —
// only one definition can be in the DataSource to avoid duplicate-entity errors.
export default new DataSource({
  type: 'postgres',
  host: appConfig.postgres.host,
  port: appConfig.postgres.port,
  username: appConfig.postgres.username,
  password: appConfig.postgres.password,
  database: appConfig.postgres.database,
  synchronize: false,
  logging: ['migration'],
  entities: [
    'apps/users/src/entities/*.entity.ts',
    'apps/auth/src/entities/refresh-token.entity.ts',
    'apps/auth/src/entities/api-key.entity.ts',
  ],
  migrations,
  migrationsTableName: 'typeorm_migrations',
});
