// src/pages/api/refresh-menu.js
import { clearMenuCache } from '@/lib/menuCache';

export default function handler(req, res) {
  // 🔒 Require secret param
  if (req.query.secret !== process.env.REVALIDATE_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  clearMenuCache(req.query.key || 'main-menu');
  return res.json({ ok: true, cleared: req.query.key || 'main-menu' });
}
