/**
 * Diagnose: at-rest decrypt issues.
 *
 * Prints the loaded key's fingerprint (SHA-256 first 8 hex), counts of
 * messages by encVersion, and attempts to decrypt one sample encVersion=1
 * doc. Compare the fingerprint against the chat service boot log; if they
 * differ the key bytes diverged between encrypt and decrypt environments.
 *
 * Usage:
 *   pnpm migrate:diagnose-messages
 */
import 'reflect-metadata';
import { createDecipheriv, createHash } from 'crypto';
import { Document, MongoClient, ObjectId } from 'mongodb';
import { appConfig } from '../config/configuration';

interface MessageDoc extends Document {
  _id: ObjectId;
  encVersion?: number;
  ciphertext?: string | null;
  iv?: string | null;
  content?: string | null;
}

function loadKey(): Buffer {
  const b64 = appConfig.messageAtRest.keyBase64;
  if (!b64) throw new Error('MESSAGE_AT_REST_KEY_BASE64 is not set');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error(`MESSAGE_AT_REST_KEY_BASE64 must decode to 32 bytes, got ${key.length}`);
  }
  return key;
}

function fingerprint(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

function tryDecrypt(key: Buffer, ciphertextB64: string, ivB64: string): string {
  const buf = Buffer.from(ciphertextB64, 'base64');
  const enc = buf.subarray(0, buf.length - 16);
  const tag = buf.subarray(buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

async function main() {
  const key = loadKey();
  console.log(`key fingerprint: ${fingerprint(key)}`);

  const client = new MongoClient(appConfig.mongo.uri);
  await client.connect();
  const messages = client.db().collection<MessageDoc>('messages');

  const counts = await messages
    .aggregate([{ $group: { _id: '$encVersion', n: { $sum: 1 } } }])
    .toArray();
  console.log('encVersion counts:');
  for (const row of counts) console.log(`  ${row._id ?? 'undefined'} → ${row.n}`);

  const sample = await messages.findOne({ encVersion: 1 });
  if (!sample) {
    console.log('\nNo encVersion=1 docs to test.');
    await client.close();
    return;
  }

  console.log(`\nsample _id=${sample._id.toString()}`);
  console.log(`  ciphertext: ${sample.ciphertext ? sample.ciphertext.slice(0, 24) + '…' : '(missing)'}`);
  console.log(`  iv:         ${sample.iv ?? '(missing)'}`);

  if (!sample.ciphertext || !sample.iv) {
    console.log('  decrypt: SKIP — fields missing');
  } else {
    try {
      const plain = tryDecrypt(key, sample.ciphertext, sample.iv);
      console.log(`  decrypt: OK    "${plain.slice(0, 60)}${plain.length > 60 ? '…' : ''}"`);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      console.log(`  decrypt: FAIL  code=${e.code ?? '-'} msg=${e.message}`);
      console.log(
        '\n→ Key fingerprint above does not match the key used to encrypt this row.\n' +
          '  Check .env, dotenvx, and any other env source. Compare with the migration\n' +
          '  fingerprint logged when pnpm migrate:encrypt-messages last ran.',
      );
    }
  }

  await client.close();
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
