/**
 * Migration: encrypt legacy plaintext messages with AES-256-GCM.
 *
 * Goal: stop storing user chat in cleartext. Existing rows have `content`
 * set; this script encrypts each one with the at-rest key, writes
 * `ciphertext` + `iv` + `encVersion: 1`, and unsets `content`.
 *
 * Idempotent — selects only rows where `encVersion` is missing or 0 AND
 * `content` is non-empty. Re-running is a no-op once all rows migrated.
 *
 * Key: 32 raw bytes, base64-encoded in MESSAGE_AT_REST_KEY_BASE64.
 *      Generate once:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *      Losing the key = losing all legacy messages. Back it up.
 *
 * Usage:
 *   pnpm migrate:encrypt-messages
 */
import 'reflect-metadata';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { Document, MongoClient, ObjectId } from 'mongodb';
import { appConfig } from '../config/configuration';

const BATCH_LOG = 500;

interface LegacyMessage extends Document {
  _id: ObjectId;
  content?: string | null;
  encVersion?: number;
}

function loadKey(): Buffer {
  const b64 = appConfig.messageAtRest.keyBase64;
  if (!b64) {
    throw new Error(
      'MESSAGE_AT_REST_KEY_BASE64 is not set. Generate one with:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error(`MESSAGE_AT_REST_KEY_BASE64 must decode to 32 bytes, got ${key.length}`);
  }
  return key;
}

function encrypt(plaintext: string, key: Buffer): { ciphertext: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

function fingerprint(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

async function main() {
  const key = loadKey();
  console.log(`key fingerprint: ${fingerprint(key)}`);

  const client = new MongoClient(appConfig.mongo.uri);
  await client.connect();
  console.log('Connected to MongoDB');

  const db = client.db();
  const messages = db.collection<LegacyMessage>('messages');

  const filter = {
    $and: [
      { $or: [{ encVersion: { $exists: false } }, { encVersion: 0 }] },
      { content: { $exists: true, $ne: null, $not: { $eq: '' } } },
    ],
  };

  const total = await messages.countDocuments(filter);
  console.log(`Found ${total} legacy plaintext message(s) to encrypt`);

  if (total === 0) {
    console.log('Nothing to do.');
    await client.close();
    return;
  }

  const cursor = messages.find(filter).batchSize(200);

  let n = 0;
  let failed = 0;

  for await (const msg of cursor) {
    if (!msg.content) continue;
    try {
      const { ciphertext, iv } = encrypt(msg.content, key);
      await messages.updateOne(
        { _id: msg._id, encVersion: { $in: [null, 0, undefined] } as never },
        {
          $set: { ciphertext, iv, encVersion: 1 },
          $unset: { content: '' },
        },
      );
      n += 1;
      if (n % BATCH_LOG === 0) console.log(`  encrypted ${n}/${total}`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ failed _id=${msg._id.toString()}:`, (err as Error).message);
    }
  }

  console.log(`\n✓ encrypted: ${n}`);
  if (failed) console.log(`✗ failed:    ${failed}`);

  await client.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
