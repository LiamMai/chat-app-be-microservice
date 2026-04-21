/**
 * Seed script — create chat rooms + sample messages between existing seed users.
 *
 * Requires seed-users.ts to have been run first.
 *
 * Usage:
 *   dotenvx run --env-file=.env -- ts-node -r tsconfig-paths/register scripts/seed-chat.ts
 *
 * What gets created
 * ─────────────────
 *   DMs
 *     user-01 ↔ user-02   (10 sample messages)
 *     user-01 ↔ user-06   (5 sample messages — cross-cluster pair)
 *     user-03 ↔ user-04   (5 sample messages)
 *
 *   Group rooms
 *     "Cluster A Chat"    members: users 01-05   (15 sample messages)
 *     "Dev Team"          members: users 01, 06, 11   (bridges all clusters, 10 messages)
 */
import 'reflect-metadata';
import { MongoClient, ObjectId } from 'mongodb';
import { DataSource } from 'typeorm';
import { appConfig } from '../config/configuration';

async function main() {
  // ── Fetch user IDs from Postgres ─────────────────────────────────────────
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

  const rows = await ds.query<{ id: string; email: string }[]>(
    `SELECT id, email FROM auth_users
     WHERE email LIKE 'seed-user-%@chat.dev'
     ORDER BY email`,
  );
  await ds.destroy();

  if (!rows.length) {
    console.error('No seed users found. Run seed-users.ts first.');
    process.exit(1);
  }

  const idByEmail: Record<string, string> = {};
  for (const r of rows) idByEmail[r.email] = r.id;

  const u = (n: number) => idByEmail[`seed-user-${String(n).padStart(2, '0')}@chat.dev`];

  // ── Connect to MongoDB ────────────────────────────────────────────────────
  const mongo = new MongoClient(appConfig.mongo.uri);
  await mongo.connect();
  console.log('Connected to MongoDB');

  const db     = mongo.db();
  const rooms  = db.collection('rooms');
  const msgs   = db.collection('messages');

  try {
    const now = new Date();

    // ── Helper to upsert a DM room ─────────────────────────────────────────
    async function upsertDm(memberA: string, memberB: string): Promise<ObjectId> {
      const existing = await rooms.findOne({
        type: 'dm',
        members: { $all: [memberA, memberB], $size: 2 },
      });
      if (existing) {
        console.log(`  — DM ${memberA.slice(0, 6)}…↔${memberB.slice(0, 6)}… already exists`);
        return existing._id as ObjectId;
      }
      const res = await rooms.insertOne({
        type: 'dm',
        name: null,
        members: [memberA, memberB],
        createdBy: memberA,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`  ✓ DM created: ${memberA.slice(0, 6)}…↔${memberB.slice(0, 6)}…`);
      return res.insertedId;
    }

    // ── Helper to upsert a group room ─────────────────────────────────────
    async function upsertGroup(name: string, createdBy: string, members: string[]): Promise<ObjectId> {
      const existing = await rooms.findOne({ type: 'group', name });
      if (existing) {
        console.log(`  — Group "${name}" already exists`);
        return existing._id as ObjectId;
      }
      const res = await rooms.insertOne({
        type: 'group',
        name,
        members: [...new Set([createdBy, ...members])],
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`  ✓ Group created: "${name}"`);
      return res.insertedId;
    }

    // ── Helper to seed messages ────────────────────────────────────────────
    async function seedMessages(
      roomId: ObjectId,
      participants: string[],
      count: number,
      topic: string,
    ) {
      const existing = await msgs.countDocuments({ roomId });
      if (existing >= count) {
        console.log(`    — ${count} messages already exist in room`);
        return;
      }

      const samples = [
        `Hey, anyone around for ${topic}?`,
        `Working on ${topic} right now`,
        `Looks good! Let me check ${topic}`,
        `Can we sync about ${topic} tomorrow?`,
        `Done with ${topic} 🎉`,
        `Just pushed the fix for ${topic}`,
        `${topic} is looking great`,
        `Should we document ${topic}?`,
        `I'll review ${topic} later today`,
        `${topic} merged! 🚀`,
        `Need to test ${topic} on staging`,
        `${topic} tests are passing`,
        `Let's discuss ${topic} in standup`,
        `Who owns ${topic}?`,
        `${topic} is blocked — need your input`,
      ];

      const docs = Array.from({ length: count }, (_, i) => {
        const sender = participants[i % participants.length];
        const ts = new Date(now.getTime() - (count - i) * 60_000); // 1 min apart
        return {
          roomId,
          senderId: sender,
          type: 'text',
          content: samples[i % samples.length],
          readBy: [sender],
          createdAt: ts,
          updatedAt: ts,
        };
      });

      await msgs.insertMany(docs);
      console.log(`    ✓ ${count} messages seeded`);
    }

    // ── DMs ───────────────────────────────────────────────────────────────
    console.log('\nSeeding DM rooms…');
    const dm01_02 = await upsertDm(u(1), u(2));
    await seedMessages(dm01_02, [u(1), u(2)], 10, 'the auth refactor');

    const dm01_06 = await upsertDm(u(1), u(6));
    await seedMessages(dm01_06, [u(1), u(6)], 5, 'cross-team coordination');

    const dm03_04 = await upsertDm(u(3), u(4));
    await seedMessages(dm03_04, [u(3), u(4)], 5, 'code review');

    // ── Groups ────────────────────────────────────────────────────────────
    console.log('\nSeeding group rooms…');
    const clusterA = await upsertGroup('Cluster A Chat', u(1), [u(1), u(2), u(3), u(4), u(5)]);
    await seedMessages(clusterA, [u(1), u(2), u(3), u(4), u(5)], 15, 'sprint planning');

    const devTeam = await upsertGroup('Dev Team', u(1), [u(1), u(6), u(11)]);
    await seedMessages(devTeam, [u(1), u(6), u(11)], 10, 'the new feature');

    console.log('\n✓ Chat seed complete');
    console.log('\nRooms created:');
    console.log('  DM:    user-01 ↔ user-02  (10 messages)');
    console.log('  DM:    user-01 ↔ user-06  (5 messages)');
    console.log('  DM:    user-03 ↔ user-04  (5 messages)');
    console.log('  Group: "Cluster A Chat"   users 01-05  (15 messages)');
    console.log('  Group: "Dev Team"         users 01, 06, 11  (10 messages)');
  } finally {
    await mongo.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
