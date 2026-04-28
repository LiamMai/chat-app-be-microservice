/**
 * One-time migration: add extended profile columns to auth_users.
 *
 * Usage:
 *   pnpm migrate:profile
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { appConfig } from '../config/configuration';

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: appConfig.postgres.host,
    port: appConfig.postgres.port,
    username: appConfig.postgres.username,
    password: appConfig.postgres.password,
    database: appConfig.postgres.database,
    synchronize: false,
    entities: [],
  });

  await ds.initialize();

  try {
    await ds.query(`
      DO $$ BEGIN
        CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await ds.query(`
      ALTER TABLE auth_users
        ADD COLUMN IF NOT EXISTS username   VARCHAR(50)  UNIQUE,
        ADD COLUMN IF NOT EXISTS bio        VARCHAR(200),
        ADD COLUMN IF NOT EXISTS gender     gender_enum,
        ADD COLUMN IF NOT EXISTS birthdate  DATE,
        ADD COLUMN IF NOT EXISTS location   VARCHAR(100),
        ADD COLUMN IF NOT EXISTS website    VARCHAR(255),
        ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS cover_url  VARCHAR(500);
    `);

    await ds.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON auth_users (username)
        WHERE username IS NOT NULL;
    `);

    console.log('✓ profile fields added to auth_users');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
