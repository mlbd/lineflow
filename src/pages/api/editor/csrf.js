// pages/api/editor/csrf.js
import { randomBytes } from 'crypto';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let token = req.cookies?.ms_csrf;
  if (!token) token = randomBytes(32).toString('hex');

  // Optional: make it short-lived (2 hours)
  const maxAge = 60 * 60 * 2;
  const isProd = process.env.NODE_ENV === 'production';

  // Prevent caching the token response
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.setHeader('Set-Cookie', [
    [
      `ms_csrf=${token}`,
      'Path=/',
      'SameSite=Strict',
      isProd ? 'Secure' : null, // only on HTTPS
      // Leave HttpOnly off for double-submit pattern
      `Max-Age=${maxAge}`, // optional: rotate periodically
    ]
      .filter(Boolean)
      .join('; '),
  ]);

  return res.json({ ok: true, token });
}
