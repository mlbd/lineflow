// lib/auth.js
import crypto from 'crypto';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || ''; // base64
const ADMIN_PASSWORD_SALT = process.env.ADMIN_PASSWORD_SALT || ''; // hex or any string

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hashPassword(password) {
  // scrypt with your salt; 64-byte key, base64 encoded
  const key = crypto.scryptSync(String(password), String(ADMIN_PASSWORD_SALT), 64);
  return key.toString('base64');
}

export function verifyCredentials(username, password) {
  const userOk = timingSafeEqualStr(ADMIN_USERNAME, username || '');
  const computed = hashPassword(password || '');
  const passOk = ADMIN_PASSWORD_HASH && timingSafeEqualStr(ADMIN_PASSWORD_HASH, computed);
  return userOk && passOk;
}

/** Helper to compute a hash in dev:
 * node -e "const c=require('crypto');const salt=c.randomBytes(16).toString('hex');const hash=c.scryptSync(process.argv[1],salt,64).toString('base64');console.log({salt,hash})" "yourPassword"
 */
