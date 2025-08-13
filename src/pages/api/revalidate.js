// src/pages/api/revalidate.js
export default async function handler(req, res) {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ message: 'Missing slug' });

  try {
    await res.revalidate(`/${slug}`);
    return res.json({ revalidated: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
