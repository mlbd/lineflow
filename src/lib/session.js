// lib/session.js
import { SignJWT, jwtVerify } from 'jose';

const secretKey = process.env.AUTH_SECRET || 'dev-secret-change-me';
const secret = new TextEncoder().encode(secretKey);
const COOKIE = 'ms_session';

export async function createSessionCookie(username, hours = 12) {
  const token = await new SignJWT({ u: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .sign(secret);

  const maxAge = hours * 60 * 60; // seconds
  // Secure cookie flags
  const cookie = `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
  return cookie;
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload?.u ? payload : null;
  } catch {
    return null;
  }
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export const SESSION_COOKIE_NAME = COOKIE;
