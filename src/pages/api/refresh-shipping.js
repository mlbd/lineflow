// src/pages/api/refresh-shipping.js
import { writeShippingCache, clearShippingCache } from '@/lib/shippingCache';

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    clearShippingCache();
    return res.status(200).json({ success: true, cleared: true });
  }

  const shippingRes = await fetch(
    `${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/shipping`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: 'IL', postcode: '', cart: [] }),
    }
  );

  if (!shippingRes.ok) {
    const text = await shippingRes.text().catch(() => '');
    return res.status(500).json({ success: false, status: shippingRes.status, text });
  }

  const json = await shippingRes.json();
  const shipping = json.shipping || [];
  writeShippingCache(shipping, 3600); // cache 1 hour (tweak as needed)
  res.status(200).json({ success: true, data: shipping });
}
