// src/pages/api/cache/product/clear.js
import { clearProductCache, primeProductCache } from '@/lib/productCache';

export const config = {
  api: {
    bodyParser: true, // use Next's JSON parser (default)
  },
};

function sameOriginOk(req) {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  if (!origin || !host) return true; // best effort in dev/tools
  try {
    return new URL(origin).host === host;
  } catch {
    return origin.endsWith(host);
  }
}

export default async function handler(req, res) {
  const dev = process.env.NODE_ENV !== 'production';
  if (dev) console.log('[api] /api/cache/product/clear ENTER', req.method, req.url);

  if (req.method !== 'POST') {
    if (dev) console.log('[api] method not allowed');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Path 1: classic secret (back-compat)
  const secret = req.query.secret || req.headers['x-ms-cache-secret'];
  const useSecret = !!secret && secret === process.env.REVALIDATE_SECRET;
  if (dev) console.log('[api] useSecret:', useSecret);

  // Path 2: Same-origin + CSRF (no secret exposed)
  if (!useSecret) {
    const originOk = sameOriginOk(req);
    if (dev) console.log('[api] sameOriginOk:', originOk);
    if (!originOk) {
      return res.status(403).json({ ok: false, error: 'Forbidden (origin)' });
    }

    const csrfHeader = req.headers['x-ms-csrf'];
    const csrfCookie = req.cookies?.ms_csrf;
    if (dev) {
      console.log('[api] csrfHeader:', csrfHeader);
      console.log('[api] csrfCookie:', csrfCookie);
    }
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({ ok: false, error: 'Forbidden (csrf)' });
    }
  }

  // Use Next's parsed body; also read from query for back-compat
  const body = req.body ?? {};
  if (dev) console.log('[api] body:', body);

  const id = Number(req.query.id ?? body.id);
  if (!id) {
    if (dev) console.log('[api] missing id');
    return res.status(400).json({ ok: false, error: 'Missing id' });
  }

  if (dev) console.log('[api] clearProductCache:', id);
  const r = clearProductCache(id);

  // Optional prime
  const primeStr = String(req.query.prime ?? body.prime ?? '');
  const prime = primeStr === '1' || primeStr === 'true';
  let primed;
  if (prime) {
    try {
      const pr = await primeProductCache(id);
      primed = pr?.primed ?? id;
      if (dev) console.log('[api] primed:', primed);
    } catch (e) {
      if (dev) console.log('[api] prime error:', e?.message || e);
    }
  }

  if (dev) console.log('[api] DONE');
  res.setHeader('x-handler', 'pages-clear.js'); // helpful while debugging
  return res.json({
    ok: true,
    cleared: r.cleared,
    ...(prime ? { primed } : {}),
    using: useSecret ? 'secret' : 'csrf',
  });
}
