// src/pages/api/refresh-shipping.js
import { clearShippingCache } from '@/lib/shippingCache';

export default function handler(req, res) {
  // 🔒 Require secret param
  if (req.query.secret !== process.env.REVALIDATE_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const key = req.query.key; // e.g., "company:123|country:IL" or omit for all
  clearShippingCache(key);
  return res.json({ ok: true, cleared: key || 'all' });
}
