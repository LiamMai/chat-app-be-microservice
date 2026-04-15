/**
 * Seed script — create (or promote) the super admin account.
 *
 * Usage:
 *   dotenvx run --env-file=.env -- ts-node -r tsconfig-paths/register scripts/seed-super-admin.ts
 *
 * Env vars read: POSTGRES_*, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME
 *
 * Behaviour:
 *   - If the email doesn't exist → creates the user with role=super_admin
 *   - If the email exists but role != super_admin → promotes it to super_admin (no password change)
 *   - If the email already has role=super_admin → no-op
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { appConfig } from '../config/configuration';

// Inline the minimal entity shape so the script doesn't pull in the full NestJS app
enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

  if (!email || !password) {
    console.error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set');
    process.exit(1);
  }

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
    const existing = await ds.query<{ id: string; role: string }[]>(
      `SELECT id, role FROM auth_users WHERE email = $1 LIMIT 1`,
      [email],
    );

    if (existing.length === 0) {
      const hashed = await bcrypt.hash(password, 12);
      await ds.query(
        `INSERT INTO auth_users (email, name, password, role, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
        [email, name, hashed, Role.SUPER_ADMIN],
      );
      console.log(`✓ Super admin created: ${email}`);
    } else if (existing[0].role !== Role.SUPER_ADMIN) {
      await ds.query(
        `UPDATE auth_users SET role = $1, "updatedAt" = NOW() WHERE id = $2`,
        [Role.SUPER_ADMIN, existing[0].id],
      );
      console.log(`✓ Promoted existing user to super_admin: ${email}`);
    } else {
      console.log(`— Already super_admin, nothing to do: ${email}`);
    }
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
