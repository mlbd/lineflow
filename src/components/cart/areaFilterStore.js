// src/components/cart/areaFilterStore.js
import { create } from 'zustand';

const MODE = (process.env.NEXT_PUBLIC_USE_AREA_FILTER || 'temp').toLowerCase();

// Build a stable signature for equality checks
const toSig = arr =>
  (Array.isArray(arr) ? arr : [])
    .map(
      p =>
        `${String(p?.name || '')
          .trim()
          .toLowerCase()}:${p?.active ? 1 : 0}`
    )
    .sort()
    .join('|');

/**
 * filters: { [productId]: placements[] }
 *   - placements[] is the full effective array (with .active) to apply globally
 */
export const useAreaFilterStore = create((set, get) => ({
  mode: MODE,
  filters: {},

  setFilter: (productId, placements) => {
    if (!productId) return;
    const id = String(productId);
    const nextArr = Array.isArray(placements) ? placements : [];
    const nextSig = toSig(nextArr);

    const prev = get().filters[id];
    const prevSig = toSig(prev);

    // 👇 No-op if nothing really changed
    if (prevSig === nextSig) return;

    set(state => ({
      filters: { ...state.filters, [id]: nextArr },
    }));
  },

  clearFilter: productId => {
    if (!productId) return;
    const id = String(productId);
    set(state => {
      if (!(id in state.filters)) return state;
      const next = { ...state.filters };
      delete next[id];
      return { filters: next };
    });
  },

  resetAll: () => set({ filters: {} }),
}));
