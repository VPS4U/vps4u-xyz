import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { encryptCredentials, decryptCredentials } from '../../lib/vps-crypto.js';

const KEY = crypto.randomBytes(32).toString('base64');

describe('vps-crypto', () => {
  it('round-trip plaintext', () => {
    const plain = 'r00t-p@ssw0rd-with-#$%-special';
    const blob = encryptCredentials(plain, KEY);
    expect(decryptCredentials(blob, KEY)).toBe(plain);
  });

  it('round-trip multi-line SSH key', () => {
    const key =
      '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXkt...\n-----END OPENSSH PRIVATE KEY-----\n';
    const blob = encryptCredentials(key, KEY);
    expect(decryptCredentials(blob, KEY)).toBe(key);
  });

  it('different IV per call → different ciphertext for same plaintext', () => {
    const a = encryptCredentials('same', KEY);
    const b = encryptCredentials('same', KEY);
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it('wrong key → throws on decrypt', () => {
    const blob = encryptCredentials('secret', KEY);
    const wrongKey = crypto.randomBytes(32).toString('base64');
    expect(() => decryptCredentials(blob, wrongKey)).toThrow();
  });

  it('tampered ciphertext → throws (GCM auth tag protection)', () => {
    const blob = encryptCredentials('secret', KEY);
    blob[blob.length - 1] ^= 0xff; // flip last byte
    expect(() => decryptCredentials(blob, KEY)).toThrow();
  });

  it('missing key → throws', () => {
    expect(() => encryptCredentials('x', '')).toThrow(/VPS_CREDENTIALS_KEY/);
  });

  it('wrong key length → throws', () => {
    const tooShort = Buffer.alloc(16).toString('base64');
    expect(() => encryptCredentials('x', tooShort)).toThrow(/32 bytes/);
  });
});
