// pages/api/cache/product/clear.js
import { clearProductCache } from '@/lib/productCache';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const secret = req.query.secret || req.headers['x-ms-cache-secret'];
  if (secret !== process.env.REVALIDATE_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const id = Number(req.query.id || req.body?.id);
  if (!id) return res.status(400).json({ ok: false, error: 'Missing id' });

  const r = clearProductCache(id);
  return res.json({ ok: true, ...r });
}
