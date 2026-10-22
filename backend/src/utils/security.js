const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');

// The message key lives in backend/.env.local (untracked) so it is never committed alongside backend/.env.
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') });

const BCRYPT_ROUNDS = 10;
const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;
const MESSAGE_PREFIX = 'enc:v1:';

// ---------- Passwords (one-way bcrypt hash) ----------

const isHashed = (value) => typeof value === 'string' && BCRYPT_PREFIX.test(value);

const hashPassword = (plain) => bcrypt.hash(String(plain), BCRYPT_ROUNDS);

// Accepts a bcrypt hash, or a not-yet-migrated plaintext value (legacy rows).
// needsRehash tells the caller to store a proper hash now that the password is known to be right.
const verifyPassword = async (plain, stored) => {
  if (typeof plain !== 'string' || typeof stored !== 'string' || stored === '') {
    return { ok: false, needsRehash: false };
  }
  if (isHashed(stored)) {
    return { ok: await bcrypt.compare(plain, stored), needsRehash: false };
  }
  const a = Buffer.from(plain);
  const b = Buffer.from(stored);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, needsRehash: ok };
};

// ---------- Messages (reversible AES-256-GCM) ----------

let cachedKey = null;
const getKey = () => {
  if (cachedKey) return cachedKey;
  const hex = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('MESSAGE_ENCRYPTION_KEY must be set to 64 hex characters (32 bytes) in backend/.env.local');
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
};

const isEncrypted = (value) => typeof value === 'string' && value.startsWith(MESSAGE_PREFIX);

// Output: enc:v1:<iv>.<tag>.<ciphertext> (base64). null/empty stays as-is; already-encrypted is not re-encrypted.
const encryptText = (plain) => {
  if (plain === null || plain === undefined || plain === '') return plain;
  if (isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `${MESSAGE_PREFIX}${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${data.toString('base64')}`;
};

// Legacy plaintext rows (no prefix) pass through unchanged so reads keep working during migration.
const decryptText = (stored) => {
  if (!isEncrypted(stored)) return stored;
  try {
    const [iv, tag, data] = stored.slice(MESSAGE_PREFIX.length).split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('[decryptText] failed to decrypt a stored value:', err.message);
    return '[Unable to decrypt message]';
  }
};

// Decrypts the `content` field of a message row, or of every row in an array.
const decryptMessageRows = (rows) => {
  if (Array.isArray(rows)) return rows.map(decryptMessageRows);
  if (rows && typeof rows === 'object' && 'content' in rows) return { ...rows, content: decryptText(rows.content) };
  return rows;
};

module.exports = {
  isHashed,
  hashPassword,
  verifyPassword,
  isEncrypted,
  encryptText,
  decryptText,
  decryptMessageRows,
};
