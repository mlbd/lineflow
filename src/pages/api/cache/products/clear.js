// src/pages/api/cache/products/clear.js
import { clearProductCache, primeProductCache } from '@/lib/productCache';

function parseJsonBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

function sameOriginOk(req) {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return origin.endsWith(host); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Path 1: classic secret (back-compat)
  const secret = req.query.secret || req.headers['x-ms-cache-secret'];
  const useSecret = !!secret && secret === process.env.REVALIDATE_SECRET;

  // Path 2: Same-origin + CSRF (no secret exposed)
  let usingCsrf = false;
  if (!useSecret) {
    if (!sameOriginOk(req)) {
      return res.status(403).json({ ok: false, error: 'Forbidden (origin)' });
    }
    const csrfHeader = req.headers['x-ms-csrf'];
    const csrfCookie = req.cookies?.ms_csrf;
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({ ok: false, error: 'Forbidden (csrf)' });
    }
    usingCsrf = true;
  }

  const body = (req.headers['content-type'] || '').includes('application/json')
    ? await parseJsonBody(req)
    : {};

  const ids = Array.isArray(body.ids) ? body.ids : [];
  const prime = String(req.query.prime ?? body.prime ?? '') === '1';

  if (ids.length) {
    const cleared = [];
    const primed = [];
    for (const raw of ids) {
      const id = Number(raw);
      if (!id) continue;
      clearProductCache(id);
      cleared.push(id);
      if (prime) {
        try { await primeProductCache(id); primed.push(id); } catch {}
      }
    }
    return res.json({
      ok: true,
      cleared,
      ...(prime ? { primed } : {}),
      using: useSecret ? 'secret' : 'csrf',
    });
  }

  // Clear ALL — allowed with secret; with CSRF require explicit confirmation.
  const clearAllAllowed =
    useSecret ||
    (usingCsrf && (body.all === true || req.query.all === '1') && (body.confirm === 'ALL' || req.query.confirm === 'ALL'));

  if (!clearAllAllowed) {
    return res.status(400).json({
      ok: false,
      error: 'Provide ids[] or (for full clear) include { all:true, confirm:"ALL" } or use secret.',
    });
  }

  const r = clearProductCache(); // no id => clear all
  return res.json({ ok: true, ...r, using: useSecret ? 'secret' : 'csrf' });
}
