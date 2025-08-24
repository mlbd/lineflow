// pages/api/cache/products/clear.js
import { clearProductCache } from '@/lib/productCache';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const secret = req.query.secret || req.headers['x-ms-cache-secret'];
  if (secret !== process.env.REVALIDATE_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const r = clearProductCache(); // no id => clear all
  return res.json({ ok: true, ...r });
}
