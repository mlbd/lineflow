// Server-only, process memory overlay for incremental changes.
// NOTE: Works great on a single long-lived Node process. On serverless it’s best-effort
// (a cold start clears it) — keep /api/slugs/revalidate as the durable fallback.
import 'server-only';

let adds = new Set(); // slugs added since last full rebuild
let removes = new Set(); // slugs removed since last full rebuild
let version = Date.now();

export function addSlugDelta(slug) {
  const s = String(slug || '')
    .toLowerCase()
    .trim();
  if (!s) return;
  removes.delete(s);
  adds.add(s);
  version = Date.now();
}

export function removeSlugDelta(slug) {
  const s = String(slug || '')
    .toLowerCase()
    .trim();
  if (!s) return;
  adds.delete(s);
  removes.add(s);
  version = Date.now();
}

export function snapshotDeltas() {
  return {
    version,
    adds: Array.from(adds),
    removes: Array.from(removes),
  };
}

export function clearDeltas() {
  adds.clear();
  removes.clear();
  version = Date.now();
}
