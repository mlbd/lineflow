const store = {
  loaded: false,
  set: new Set(),
  shards: [], // { key, count }
};

export async function loadAllSlugs() {
  if (store.loaded) return store;
  const idxRes = await fetch('/api/slugs/index', { cache: 'no-store' });
  const idx = await idxRes.json();
  if (!idx.ok) throw new Error('No slug index');
  store.shards = idx.shards || [];
  // Fetch all shards (or do this lazily if you have many)
  const texts = await Promise.all(
    store.shards.map(s => fetch(`/api/slugs/shard?key=${encodeURIComponent(s.key)}`, { cache: 'force-cache' }).then(r => r.text()))
  );
  const set = new Set();
  for (const t of texts) {
    t.split('\n').forEach(line => {
      const s = line.trim();
      if (s) set.add(s);
    });
  }
  store.set = set;
  store.loaded = true;
  return store;
}

export function slugExistsLocal(slug) {
  return store.set.has((slug || '').toLowerCase());
}
