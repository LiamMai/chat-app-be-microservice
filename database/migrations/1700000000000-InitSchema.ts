import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enums ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE auth_users_role_enum AS ENUM ('super_admin', 'admin', 'user');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE friend_status_enum AS ENUM ('pending', 'accepted', 'declined', 'blocked');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── auth_users ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email       VARCHAR(255) NOT NULL,
        name        VARCHAR(100) NOT NULL,
        password    TEXT NOT NULL,
        role        auth_users_role_enum NOT NULL DEFAULT 'user',
        "isActive"  BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_auth_users_email UNIQUE (email)
      );
    `);

    // ── refresh_tokens ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"     UUID NOT NULL,
        "tokenHash"  VARCHAR(64) NOT NULL,
        "expiresAt"  TIMESTAMPTZ NOT NULL,
        "isRevoked"  BOOLEAN NOT NULL DEFAULT false,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_refresh_tokens_hash UNIQUE ("tokenHash")
      );
    `);

    // ── api_keys ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"      UUID NOT NULL,
        name          VARCHAR(100) NOT NULL,
        "keyHash"     VARCHAR(64) NOT NULL,
        prefix        VARCHAR(12) NOT NULL,
        permissions   TEXT[] NOT NULL DEFAULT '{}',
        "expiresAt"   TIMESTAMPTZ,
        "lastUsedAt"  TIMESTAMPTZ,
        "isRevoked"   BOOLEAN NOT NULL DEFAULT false,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_api_keys_hash UNIQUE ("keyHash")
      );
    `);

    // ── friends ────────────────────────────────────────────────────────────
    await queryRunner.query(`
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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_friends_friendId_status ON friends ("friendId", status);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_friends_userId_status ON friends ("userId", status);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS friends;`);
    await queryRunner.query(`DROP TABLE IF EXISTS api_keys;`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens;`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_users;`);
    await queryRunner.query(`DROP TYPE IF EXISTS friend_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS auth_users_role_enum;`);
  }
}
