// src/utils/placements.js
/**
 * Placement utilities (shared across Cart, Group, Quantity, and Quick View).
 * All helpers are SSR-safe and pure.
 */

/** Round to 4 decimals for stable JSON keys. */
const round4 = n => Math.round(Number(n ?? 0) * 10000) / 10000;

/**
 * Build a deterministic signature from ACTIVE placements, **including side-awareness** for __forceBack.
 * Example returns:
 *   "front|sleeve__fb:default"               // no Back toggled for active placements
 *   "front|sleeve__fb:front"                 // 'front' is Back
 *   "back__fb:back"                          // only back active and Back-toggled
 *   "default"                                 // no active placements
 */
export function buildPlacementSignature(placements) {
  try {
    const src = Array.isArray(placements) ? placements : [];
    const actives = src
      .filter(p => p && p.name && p.active)
      .map(p => String(p.name).trim().toLowerCase());
    if (!actives.length) return 'default';

    const backActives = src
      .filter(p => p && p.name && p.active && p.__forceBack === true)
      .map(p => String(p.name).trim().toLowerCase())
      .sort();
    const backSuffix = backActives.length ? `__fb:${backActives.join(',')}` : '__fb:default';
    return actives.sort().join('|') + '|' + backSuffix;
  } catch {
    return 'default';
  }
}

/**
 * Create a stable, strict JSON key for **exact** placement equality (used in Quantity merge).
 * Includes: name, active, __forceBack (as `b`), and normalized x/y/w/h/r.
 */
export function normalizePlacementsForKey(placements = []) {
  const norm = (Array.isArray(placements) ? placements : [])
    .map(p => ({
      name: String(p?.name ?? ''),
      active: !!p?.active,
      b: !!p?.__forceBack, // side-awareness
      x: round4(p?.xPercent),
      y: round4(p?.yPercent),
      w: round4(p?.wPercent),
      h: round4(p?.hPercent),
      r: round4(p?.rotate),
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.x - b.x ||
        a.y - b.y ||
        a.w - b.w ||
        a.h - b.h ||
        a.r - b.r ||
        (a.b === b.b ? 0 : a.b ? -1 : 1) ||
        (a.active === b.active ? 0 : a.active ? -1 : 1)
    );
  return JSON.stringify(norm);
}
