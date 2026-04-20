/**
 * One-time migration: create friends table.
 *
 * Usage:
 *   dotenvx run --env-file=.env -- ts-node -r tsconfig-paths/register scripts/migrate-friends-table.ts
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
        CREATE TYPE friend_status_enum AS ENUM ('pending', 'accepted', 'declined', 'blocked');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await ds.query(`
      CREATE TABLE IF NOT EXISTS friends (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"    UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        "friendId"  UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        status      friend_status_enum NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_friends_pair UNIQUE ("userId", "friendId")
      );
    `);

    await ds.query(`CREATE INDEX IF NOT EXISTS idx_friends_friendId_status ON friends ("friendId", status);`);
    await ds.query(`CREATE INDEX IF NOT EXISTS idx_friends_userId_status   ON friends ("userId",   status);`);

    console.log('✓ friends table ready');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
