// src/pages/api/revalidate.js
export default async function handler(req, res) {
  // 🔒 Require secret param
  if (req.query.secret !== process.env.REVALIDATE_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const q = req.query || {};
    let b = {};
    try {
      b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    } catch {
      b = req.body || {};
    }

    const slugs = [];
    const paths = [];
    const push = (arr, v) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') arr.push(String(v).trim());
    };

    // Collect from query/body
    if (q.slug) push(slugs, q.slug);
    if (q.slugs) {
      (Array.isArray(q.slugs) ? q.slugs : String(q.slugs).split(',')).forEach(v => push(slugs, v));
    }
    if (q.path) push(paths, q.path);
    if (q.paths) {
      (Array.isArray(q.paths) ? q.paths : String(q.paths).split(',')).forEach(v => push(paths, v));
    }
    if (b.slug) push(slugs, b.slug);
    if (Array.isArray(b.slugs)) b.slugs.forEach(v => push(slugs, v));
    if (b.path) push(paths, b.path);
    if (Array.isArray(b.paths)) b.paths.forEach(v => push(paths, v));

    const toPaths = Array.from(
      new Set([
        ...paths.map(p => `/${String(p).replace(/^\/+/, '')}`),
        ...slugs.map(s => `/${String(s).replace(/^\/+/, '')}`),
      ])
    );

    if (toPaths.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'Provide ?slug=, ?slugs=, ?path=, ?paths= or JSON body { slugs|paths }',
      });
    }

    const revalidated = [];
    const errors = [];

    for (const p of toPaths) {
      try {
        if (typeof res.revalidate === 'function') {
          await res.revalidate(p);
        } else if (typeof res.unstable_revalidate === 'function') {
          await res.unstable_revalidate(p);
        } else {
          throw new Error('Revalidate API not available in this runtime.');
        }
        revalidated.push(p);
      } catch (e) {
        errors.push({ path: p, error: e?.message || String(e) });
      }
    }

    return res.json({
      ok: errors.length === 0,
      method: req.method,
      count: toPaths.length,
      revalidated,
      errors,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Revalidate failed' });
  }
}
