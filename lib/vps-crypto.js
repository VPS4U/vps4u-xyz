// AES-256-GCM szyfrowanie SSH credentials (hasło lub klucz prywatny) before-store.
// Klucz w env VPS_CREDENTIALS_KEY — 32 bajty zakodowane base64 (44 znaki).
// Wygeneruj raz: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
// i wklej do Vercel env (production + preview + development).
//
// Format ciphertext (bytea w DB): [iv(12B) | authTag(16B) | ciphertext(N)]

import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(base64Key) {
  if (!base64Key) {
    throw new Error('VPS_CREDENTIALS_KEY missing');
  }
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error(`VPS_CREDENTIALS_KEY must be 32 bytes (base64-encoded); got ${key.length}`);
  }
  return key;
}

/**
 * @param {string} plaintext  hasło lub klucz prywatny SSH (multi-line OK)
 * @param {string} base64Key  z env
 * @returns {Buffer}  [iv|tag|ct]
 */
export function encryptCredentials(plaintext, base64Key) {
  const key = loadKey(base64Key);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

/**
 * @param {Buffer|Uint8Array} blob
 * @param {string} base64Key
 * @returns {string}  oryginalny plaintext
 */
export function decryptCredentials(blob, base64Key) {
  const key = loadKey(base64Key);
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Encrypted blob too short — corrupted or wrong format');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
