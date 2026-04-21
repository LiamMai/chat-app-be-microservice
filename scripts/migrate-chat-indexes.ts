/**
 * Migration: ensure MongoDB indexes for chat collections.
 *
 * Idempotent — drops any conflicting index by key spec before recreating
 * with the canonical name. Safe to run multiple times.
 *
 * Usage:
 *   dotenvx run --env-file=.env -- ts-node -r tsconfig-paths/register scripts/migrate-chat-indexes.ts
 */
import 'reflect-metadata';
import { Collection, Document, MongoClient } from 'mongodb';
import { appConfig } from '../config/configuration';

/**
 * Drop an index that matches the given key spec, regardless of its name.
 * No-ops if no matching index exists.
 */
async function dropByKeySpec(col: Collection<Document>, keySpec: Record<string, unknown>) {
  const existing = await col.indexes();
  const specStr = JSON.stringify(keySpec);

  for (const idx of existing) {
    if (idx.name === '_id_') continue;
    if (JSON.stringify(idx.key) === specStr) {
      await col.dropIndex(idx.name as string);
      console.log(`  dropped old index "${idx.name}" on ${col.collectionName}`);
      return;
    }
  }
}

async function main() {
  const client = new MongoClient(appConfig.mongo.uri);
  await client.connect();
  console.log('Connected to MongoDB');

  const db = client.db();

  try {
    // ── rooms ──────────────────────────────────────────────────────────────
    const rooms = db.collection('rooms');

    await dropByKeySpec(rooms, { members: 1, updatedAt: -1 });
    await rooms.createIndex({ members: 1, updatedAt: -1 }, { name: 'idx_rooms_members_updated' });
    console.log('✓ rooms: members + updatedAt');

    await dropByKeySpec(rooms, { type: 1, members: 1 });
    await rooms.createIndex(
      { type: 1, members: 1 },
      { name: 'idx_rooms_type_members', partialFilterExpression: { type: 'dm' } },
    );
    console.log('✓ rooms: type + members (DM dedup partial)');

    // ── messages ───────────────────────────────────────────────────────────
    const messages = db.collection('messages');

    await dropByKeySpec(messages, { roomId: 1, createdAt: -1 });
    await messages.createIndex({ roomId: 1, createdAt: -1 }, { name: 'idx_messages_room_created' });
    console.log('✓ messages: roomId + createdAt');

    await dropByKeySpec(messages, { roomId: 1, readBy: 1 });
    await messages.createIndex({ roomId: 1, readBy: 1 }, { name: 'idx_messages_room_readby' });
    console.log('✓ messages: roomId + readBy (unread counts)');

    console.log('\n✓ All chat indexes ready');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
