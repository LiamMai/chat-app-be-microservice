/**
 * Seed script — create test users + friend relationships.
 *
 * Safe to run multiple times (idempotent via ON CONFLICT DO NOTHING).
 * Designed so new developers can clone the repo, run this once, and have
 * a realistic dataset to work with immediately.
 *
 * Usage:
 *   dotenvx run --env-file=.env -- ts-node -r tsconfig-paths/register scripts/seed-users.ts
 *
 * What gets created
 * ─────────────────
 *   1 admin    seed-admin@chat.dev       / Seed@12345
 *  30 users    seed-user-NN@chat.dev     / Seed@12345   (NN = 01-30)
 *
 * Friend graph (for testing suggestion algorithm)
 * ───────────────────────────────────────────────
 *   Cluster A  users 01-05  all accepted with each other   (10 edges)
 *   Cluster B  users 06-10  all accepted with each other   (10 edges)
 *   Cluster C  users 11-15  all accepted with each other   (10 edges)
 *   Bridge     user-01  ↔  user-06                         (cross-cluster)
 *   Bridge     user-06  ↔  user-11                         (cross-cluster)
 *
 *   Pending    user-16 → user-01   (outgoing from 16, incoming to 01)
 *   Pending    user-17 → user-02
 *   Pending    user-18 → user-03
 *
 *   Declined   user-19 → user-04  (declined by 04)
 *
 *   Blocked    user-20 blocked by user-01
 *
 *   Isolated   users 21-30  no relationships  (pure fallback pool)
 *
 * Suggestion expectations
 * ───────────────────────
 *   GET /friends/suggestions as user-01
 *     → mutual-friends tier: users 06-10 (via user-06), users 11-15 (via user-06→11)
 *     → fallback tier:       users 16-19, 21-30 (active, not connected, not blocked)
 *     → excluded:            user-20 (blocked), user-01's cluster A friends
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { appConfig } from '../config/configuration';

enum Role { SUPER_ADMIN = 'super_admin', ADMIN = 'admin', USER = 'user' }
enum FriendStatus { PENDING = 'pending', ACCEPTED = 'accepted', DECLINED = 'declined', BLOCKED = 'blocked' }

// ── User definitions ─────────────────────────────────────────────────────────

const PASSWORD = 'Seed@12345';

interface SeedUser {
  email: string;
  name: string;
  role: Role;
}

function makeUser(n: number): SeedUser {
  const nn = String(n).padStart(2, '0');
  return {
    email: `seed-user-${nn}@chat.dev`,
    name: `Seed User ${nn}`,
    role: Role.USER,
  };
}

const USERS: SeedUser[] = [
  { email: 'seed-admin@chat.dev', name: 'Seed Admin', role: Role.ADMIN },
  ...Array.from({ length: 30 }, (_, i) => makeUser(i + 1)),
];

// ── Friend relationship definitions ─────────────────────────────────────────

/** Zero-based indexes into USERS array (admin=0, user-01=1, …, user-30=30) */
type FriendEdge = { a: number; b: number; status: FriendStatus };

function clusterEdges(members: number[]): FriendEdge[] {
  const edges: FriendEdge[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      edges.push({ a: members[i], b: members[j], status: FriendStatus.ACCEPTED });
    }
  }
  return edges;
}

const EDGES: FriendEdge[] = [
  // Cluster A: users 01-05 (indexes 1-5)
  ...clusterEdges([1, 2, 3, 4, 5]),
  // Cluster B: users 06-10 (indexes 6-10)
  ...clusterEdges([6, 7, 8, 9, 10]),
  // Cluster C: users 11-15 (indexes 11-15)
  ...clusterEdges([11, 12, 13, 14, 15]),
  // Bridges
  { a: 1,  b: 6,  status: FriendStatus.ACCEPTED },
  { a: 6,  b: 11, status: FriendStatus.ACCEPTED },
  // Pending requests (a sent to b)
  { a: 16, b: 1,  status: FriendStatus.PENDING },
  { a: 17, b: 2,  status: FriendStatus.PENDING },
  { a: 18, b: 3,  status: FriendStatus.PENDING },
  // Declined (a sent to b, b declined)
  { a: 19, b: 4,  status: FriendStatus.DECLINED },
  // Blocked (user-01 blocked user-20: userId=1, friendId=20)
  { a: 1,  b: 20, status: FriendStatus.BLOCKED },
];

// ── Main ─────────────────────────────────────────────────────────────────────

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
  console.log('Connected to database');

  try {
    const hashed = await bcrypt.hash(PASSWORD, 12);

    // ── 1. Upsert users ───────────────────────────────────────────────────────
    console.log('\nSeeding users…');

    for (const user of USERS) {
      await ds.query(
        `INSERT INTO auth_users (email, name, password, role, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [user.email, user.name, hashed, user.role],
      );
    }

    // Fetch back IDs in insertion order (by email)
    const rows = await ds.query<{ id: string; email: string }[]>(
      `SELECT id, email FROM auth_users WHERE email = ANY($1) ORDER BY email`,
      [USERS.map((u) => u.email)],
    );

    // Map email → id for quick lookup
    const idByEmail: Record<string, string> = {};
    for (const row of rows) idByEmail[row.email] = row.id;

    // Ordered array matching USERS array (admin=0, user-01=1, …)
    const ids = USERS.map((u) => idByEmail[u.email]);

    const missing = USERS.filter((u) => !idByEmail[u.email]);
    if (missing.length) {
      console.warn('  ⚠ Could not find IDs for:', missing.map((u) => u.email));
    }

    console.log(`  ✓ ${USERS.length} users ready`);

    // ── 2. Upsert friend relations ────────────────────────────────────────────
    console.log('\nSeeding friend relationships…');

    let inserted = 0;
    let skipped  = 0;

    for (const edge of EDGES) {
      const userId   = ids[edge.a];
      const friendId = ids[edge.b];
      if (!userId || !friendId) {
        console.warn(`  ⚠ Skipping edge ${edge.a}↔${edge.b} — ID missing`);
        continue;
      }

      const result = await ds.query<{ id: string }[]>(
        `INSERT INTO friends ("userId", "friendId", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT ("userId", "friendId") DO NOTHING
         RETURNING id`,
        [userId, friendId, edge.status],
      );

      if (result.length) inserted++;
      else skipped++;
    }

    console.log(`  ✓ ${inserted} edges inserted, ${skipped} already existed`);

    // ── 3. Summary ────────────────────────────────────────────────────────────
    console.log('\n──────────────────────────────────────────────');
    console.log('Seed complete. Credentials for all accounts:');
    console.log('  Password: Seed@12345');
    console.log('\nKey accounts:');
    console.log('  seed-admin@chat.dev      — ADMIN');
    console.log('  seed-user-01@chat.dev    — USER (cluster A, has bridges to B & C)');
    console.log('  seed-user-06@chat.dev    — USER (cluster B, bridge to A & C)');
    console.log('  seed-user-16@chat.dev    — USER (pending → user-01)');
    console.log('  seed-user-20@chat.dev    — USER (blocked by user-01)');
    console.log('  seed-user-21..30         — USER (isolated, fallback pool)');
    console.log('\nSuggestion test:');
    console.log('  Login as user-01, call GET /friends/suggestions');
    console.log('  Expect: cluster B+C users in mutual tier, users 21-30 in fallback tier');
    console.log('──────────────────────────────────────────────\n');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
