import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileFields1746000000000 implements MigrationInterface {
  name = 'AddProfileFields1746000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
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

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON auth_users (username)
        WHERE username IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_username;`);
    await queryRunner.query(`
      ALTER TABLE auth_users
        DROP COLUMN IF EXISTS cover_url,
        DROP COLUMN IF EXISTS avatar_url,
        DROP COLUMN IF EXISTS website,
        DROP COLUMN IF EXISTS location,
        DROP COLUMN IF EXISTS birthdate,
        DROP COLUMN IF EXISTS gender,
        DROP COLUMN IF EXISTS bio,
        DROP COLUMN IF EXISTS username;
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS gender_enum;`);
  }
}
