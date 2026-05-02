import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { appConfig } from 'config/configuration';

/**
 * AES-256-GCM at-rest encryption for message bodies.
 *
 * encVersion mapping:
 *   0 / undefined — legacy plaintext (`content`)
 *   1            — server-side AES-GCM (`ciphertext` + `iv`)
 *   2            — client E2EE (server cannot decrypt — passes through)
 */

interface EncryptedFields {
  ciphertext: string;
  iv: string;
}

interface DecryptableDoc {
  _id?: unknown;
  content?: string | null;
  ciphertext?: string | null;
  iv?: string | null;
  encVersion?: number | null;
}

/**
 * Short, non-reversible identifier of a key. Logged on boot + during
 * migration so a key mismatch becomes obvious without leaking the key.
 */
export function keyFingerprint(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

@Injectable()
export class MessageCrypto implements OnModuleInit {
  private readonly logger = new Logger(MessageCrypto.name);
  private key: Buffer | null = null;
  private strict = true;

  onModuleInit() {
    this.strict = process.env.MESSAGE_DECRYPT_STRICT !== 'false';

    const b64 = appConfig.messageAtRest.keyBase64;
    if (!b64) {
      this.logger.warn(
        'MESSAGE_AT_REST_KEY_BASE64 not set — messages will be stored as PLAINTEXT. ' +
          'Set the env var to enable at-rest encryption.',
      );
      return;
    }
    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) {
      throw new Error(
        `MESSAGE_AT_REST_KEY_BASE64 must decode to 32 bytes, got ${key.length}`,
      );
    }
    this.key = key;
    this.logger.log(
      `at-rest encryption enabled — key fingerprint=${keyFingerprint(key)} strict=${this.strict}`,
    );
  }

  /** True when an at-rest key is configured. */
  isEnabled(): boolean {
    return this.key !== null;
  }

  /** Encrypt plaintext for storage. Returns { ciphertext, iv } base64. */
  encrypt(plaintext: string): EncryptedFields {
    if (!this.key) throw new Error('At-rest key not configured');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: Buffer.concat([enc, tag]).toString('base64'),
      iv: iv.toString('base64'),
    };
  }

  /** Decrypt a stored ciphertext. Throws on tag mismatch / wrong key. */
  decrypt(ciphertextB64: string, ivB64: string): string {
    if (!this.key) throw new Error('At-rest key not configured');
    const buf = Buffer.from(ciphertextB64, 'base64');
    const enc = buf.subarray(0, buf.length - 16);
    const tag = buf.subarray(buf.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  /**
   * Mutate a message doc in-place: replace `ciphertext`/`iv` with plaintext
   * `content` based on `encVersion`. Safe on plain objects (lean) and
   * Mongoose docs (use `.toObject()` first).
   *
   * In strict mode (default) a decrypt failure is rethrown so the
   * exception filter surfaces the real cause instead of silently nulling
   * content. Set MESSAGE_DECRYPT_STRICT=false in prod to fall back to
   * null + log behaviour.
   */
  decryptDoc<T extends DecryptableDoc>(doc: T): T {
    if (!doc) return doc;
    const v = doc.encVersion ?? 0;
    if (v === 0) return doc; // already plaintext

    if (v === 1) {
      if (!doc.ciphertext || !doc.iv) {
        const msg = `encVersion=1 doc missing ciphertext/iv (id=${String(doc._id)})`;
        this.logger.error(msg);
        if (this.strict) throw new Error(msg);
        doc.content = null;
        return doc;
      }

      try {
        doc.content = this.decrypt(doc.ciphertext, doc.iv);
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        const fp = this.key ? keyFingerprint(this.key) : 'none';
        this.logger.error(
          `decrypt failed id=${String(doc._id)} fingerprint=${fp} code=${e.code ?? '-'} msg=${e.message}`,
        );
        if (this.strict) throw err;
        doc.content = null;
        return doc;
      }

      // Strip raw fields from outbound payload only on success.
      doc.ciphertext = null;
      doc.iv = null;
      return doc;
    }

    // encVersion 2 → client decrypts; leave ciphertext intact, content null
    return doc;
  }

  decryptMany<T extends DecryptableDoc>(docs: T[]): T[] {
    return docs.map((d) => this.decryptDoc(d));
  }
}
