import { writeShippingCache } from '@/lib/shippingCache';

export default async function handler(req, res) {
  // Re-fetch shipping from WP and overwrite the cache
  const shippingRes = await fetch(`${process.env.NEXT_PUBLIC_WP_SITE_URL}/wp-json/mini-sites/v1/shipping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      country: 'IL',
      postcode: '',
      cart: [],
    }),
  });
  if (shippingRes.ok) {
    const shippingData = await shippingRes.json();
    writeShippingCache(shippingData.shipping || []);
    res.status(200).json({ success: true, data: shippingData.shipping });
  } else {
    res.status(500).json({ success: false });
  }
}