import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameNameToFirstLastName1746500000000 implements MigrationInterface {
  name = 'RenameNameToFirstLastName1746500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth_users
        ADD COLUMN IF NOT EXISTS first_name VARCHAR(50) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS last_name  VARCHAR(50) NOT NULL DEFAULT '';
    `);

    // Migrate existing data: full name → first_name, leave last_name empty
    await queryRunner.query(`
      UPDATE auth_users SET first_name = name WHERE name IS NOT NULL AND first_name = '';
    `);

    await queryRunner.query(`ALTER TABLE auth_users DROP COLUMN IF EXISTS name;`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT '';
    `);

    await queryRunner.query(`
      UPDATE auth_users SET name = TRIM(first_name || ' ' || last_name);
    `);

    await queryRunner.query(`
      ALTER TABLE auth_users
        DROP COLUMN IF EXISTS first_name,
        DROP COLUMN IF EXISTS last_name;
    `);
  }
}
