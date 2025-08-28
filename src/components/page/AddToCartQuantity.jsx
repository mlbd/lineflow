// src/components/page/AddToCartQuantity.jsx
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import clsx from 'clsx';
import { applyBumpPrice } from '@/utils/price';
import { X } from 'lucide-react';
import { useCartStore } from '@/components/cart/cartStore';
import { useAreaFilterStore } from '@/components/cart/areaFilterStore';

// Cache the first non-empty baseline per product id, so user filters can't mutate it later.
const __baselinePlacementCache =
  typeof window !== 'undefined' ? (window.__baselinePlacementCache ||= new Map()) : new Map();

const QTY_LIMIT = 50000;

/* ---------------- helpers: signature + placements ---------------- */
function buildPlacementSignature(placements) {
  try {
    const actives = (Array.isArray(placements) ? placements : [])
      .filter(p => !!p && !!p.active && p.name)
      .map(p => String(p.name).trim().toLowerCase());
    if (!actives.length) return 'default';
    return actives.sort().join('|');
  } catch {
    return 'default';
  }
}

function coercePlacementArray(val, pid) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') {
        const key = String(pid || '');
        if (Array.isArray(parsed[key])) return parsed[key];
        if (Array.isArray(parsed.placements)) return parsed.placements;
      }
    } catch {}
  }
  if (val && typeof val === 'object') {
    const key = String(pid || '');
    if (Array.isArray(val[key])) return val[key];
    if (Array.isArray(val.placements)) return val.placements;
  }
  return [];
}

/** order-insensitive normalized placements for exact-same-selection checks */
function normalizePlacementsForKey(placements = []) {
  const norm = (Array.isArray(placements) ? placements : [])
    .map(p => ({
      name: String(p?.name ?? ''),
      active: !!p?.active,
      x: Math.round(Number(p?.xPercent ?? 0) * 10000) / 10000,
      y: Math.round(Number(p?.yPercent ?? 0) * 10000) / 10000,
      w: Math.round(Number(p?.wPercent ?? 0) * 10000) / 10000,
      h: Math.round(Number(p?.hPercent ?? 0) * 10000) / 10000,
      r: Math.round(Number(p?.rotate ?? 0) * 10000) / 10000,
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.x - b.x ||
        a.y - b.y ||
        a.w - b.w ||
        a.h - b.h ||
        a.r - b.r ||
        (a.active === b.active ? 0 : a.active ? -1 : 1)
    );
  return JSON.stringify(norm);
}

export default function AddToCartQuantity({
  open,
  onClose,
  product,
  bumpPrice,
  onCartAddSuccess,
  pagePlacementMap = {},
}) {
  // Safe fallbacks so hooks aren’t conditional
  const safeProduct = product || {};
  const acf = safeProduct.acf || {};
  const steps = applyBumpPrice(acf.quantity_steps || [], bumpPrice);
  const visibleSteps = steps.filter(s => !s.hide);

  // 0 = Custom, 1..N = visibleSteps index + 1
  const [selectedIdx, setSelectedIdx] = useState(1);
  const [customQty, setCustomQty] = useState('');
  const [error, setError] = useState(null);

  // cart store
  const cartItems = useCartStore(s => s.items);
  const addItem = useCartStore(s => s.addItem);
  const updateItemQuantity = useCartStore(s => s.updateItemQuantity);
  const removeItem = useCartStore(s => s.removeItem);

  // area filter
  const filters = useAreaFilterStore(s => s.filters);
  const clearFilter = useAreaFilterStore(s => s.clearFilter);
  const mode = useAreaFilterStore(s => s.mode);

  // ---- Pricing helpers ----
  const getPriceForQuantity = useCallback(
    qty => {
      if (!qty || !visibleSteps.length) return 0;
      let applicable = visibleSteps[0];
      for (const step of visibleSteps) {
        if (qty >= parseInt(step.quantity)) applicable = step;
        else break;
      }
      return applicable ? parseFloat(applicable.amount) : 0;
    },
    [visibleSteps]
  );

  const handleCustomQty = val => {
    let newVal = val.replace(/[^0-9]/g, '');
    const n = parseInt(newVal || 0) || 0;
    if (newVal && n > QTY_LIMIT) {
      setError(`כמות מקסימלית לרכישה: ${QTY_LIMIT}`);
    } else if (newVal && n < minStep) {
      setError(`הכמות המינימלית היא ${minStep}`);
    } else {
      setError(null);
    }
    setCustomQty(newVal);
  };

  // ---- Resolve placements (same precedence as Group) ----
  const pid = String(safeProduct?.id || '');
  let effectivePlacements = Array.isArray(safeProduct?.placement_coordinates)
    ? safeProduct.placement_coordinates
    : [];
  if (filters && filters[pid] && Array.isArray(filters[pid])) {
    effectivePlacements = filters[pid];
  } else if (pagePlacementMap && typeof pagePlacementMap === 'object' && pagePlacementMap[pid]) {
    effectivePlacements = coercePlacementArray(pagePlacementMap[pid], safeProduct?.id);
  }

  // —— Baseline placements (FIRST non-empty snapshot from product.placement_coordinates; cached per product id) ——
  const baselinePlacementsRef = useMemo(() => {
    const key = String(product?.id || '');
    const cached = __baselinePlacementCache.get(key);
    if (cached && Array.isArray(cached) && cached.length) return cached;
    const raw = Array.isArray(product?.placement_coordinates)
      ? product.placement_coordinates
      : coercePlacementArray(product?.placement_coordinates, product?.id);
    const hasActive = Array.isArray(raw) && raw.some(p => p?.active);
    if (hasActive) {
      const clone = JSON.parse(JSON.stringify(raw)); // deep clone to avoid external mutation
      __baselinePlacementCache.set(key, clone);
      return clone;
    }
    // fall back to cached (if any) or empty array
    return Array.isArray(raw) ? raw : [];
  }, [product?.id]); // depend only on product id

  // --- extra_print_price per extra placement (selected - default) ---
  const countActive = arr => (Array.isArray(arr) ? arr.filter(p => p?.active).length : 0);
  const baselineActive = countActive(baselinePlacementsRef);
  const selectedActive = countActive(effectivePlacements);
  const extraPrice = Math.max(0, Number(safeProduct?.extra_print_price) || 0);
  const extraEach = Math.max(0, selectedActive - baselineActive) * extraPrice;

  const minStep = visibleSteps[0] ? parseInt(visibleSteps[0].quantity) : 1;
  const customQtyNum = parseInt(customQty || 0) || 0;
  const isCustomSelected = selectedIdx === 0;
  const isCustomEmpty = isCustomSelected && customQty === '';
  const isCustomTooLow = isCustomSelected && customQty !== '' && customQtyNum < minStep;

  // (kept for any other uses; not shown in UI when pooling preview is used)
  const customPricing = useMemo(() => {
    if (!isCustomSelected || isCustomEmpty || isCustomTooLow) {
      return { unitPrice: 0, total: 0 };
    }
    const unitPrice = getPriceForQuantity(customQtyNum);
    const total = customQtyNum * unitPrice;
    return { unitPrice, total };
  }, [isCustomSelected, isCustomEmpty, isCustomTooLow, customQtyNum, getPriceForQuantity]);

  const placementSignature = buildPlacementSignature(effectivePlacements);
  const baselineSignature = buildPlacementSignature(baselinePlacementsRef);
  const filterWasChanged = placementSignature !== baselineSignature;
  const expectedMergeKey = filterWasChanged
    ? normalizePlacementsForKey(effectivePlacements)
    : 'default';

  const activeAreaNames = useMemo(
    () =>
      (Array.isArray(effectivePlacements) ? effectivePlacements : [])
        .filter(p => p?.active && p?.name)
        .map(p => String(p.name)),
    [effectivePlacements]
  );

  // Find existing matching line (for prefill AND pooled math)
  const existingMatch = useMemo(() => {
    return (Array.isArray(cartItems) ? cartItems : [])
      .map((it, index) => ({ it, index }))
      .find(({ it }) => {
        if (String(it?.product_id || '') !== pid) return false;
        if (it?.options?.line_type !== 'Quantity') return false;
        const mk = String(it?.options?.placement_merge_key || '');
        if (mk && mk === expectedMergeKey) return true;
        const sameSig =
          (filterWasChanged &&
            it?.filter_was_changed === true &&
            buildPlacementSignature(it?.placement_coordinates) === placementSignature) ||
          (!filterWasChanged && !it?.filter_was_changed);
        const sameSnap = !filterWasChanged
          ? true
          : normalizePlacementsForKey(it?.placement_coordinates) === expectedMergeKey;
        return sameSig && sameSnap;
      });
  }, [cartItems, pid, expectedMergeKey, filterWasChanged, placementSignature]);

  // Pooled total already in cart for this product (excluding the matching line if any)
  const pooledTotalOther = useMemo(() => {
    const sameProductLines = (Array.isArray(cartItems) ? cartItems : []).filter(
      it =>
        String(it?.product_id || '') === pid &&
        (it?.pricing?.type === 'Quantity' || it?.options?.line_type === 'Quantity')
    );
    const totalAll = sameProductLines.reduce((s, it) => s + (parseInt(it.quantity) || 0), 0);
    const matchQty = existingMatch ? parseInt(existingMatch.it?.quantity) || 0 : 0;
    return Math.max(0, totalAll - matchQty);
  }, [cartItems, pid, existingMatch]);

  // Given a candidate qty from the UI, what base unit will apply AFTER adding?
  const getPooledUnitBase = useCallback(
    candidateQty => getPriceForQuantity(pooledTotalOther + (parseInt(candidateQty) || 0)),
    [getPriceForQuantity, pooledTotalOther]
  );

  // Current selection → pooled base
  const { quantity, unitBase } = useMemo(() => {
    if (isCustomSelected) {
      const q = isCustomEmpty ? 0 : customQtyNum;
      return { quantity: q, unitBase: getPooledUnitBase(q) };
    } else {
      const idx = selectedIdx - 1;
      const q = visibleSteps[idx] ? parseInt(visibleSteps[idx].quantity || 0) : 0;
      return { quantity: q, unitBase: getPooledUnitBase(q) };
    }
  }, [isCustomSelected, isCustomEmpty, customQtyNum, selectedIdx, visibleSteps, getPooledUnitBase]);

  // Final unit with extras for extra placements
  const unitWithExtra = (Number(unitBase) || 0) + (extraEach || 0);

  // (logs moved AFTER declarations to avoid TDZ)
  // console.log('unitWithExtra', unitWithExtra);
  // console.log('unitBase', unitBase);
  // console.log('extraEach', extraEach);
  // console.log('visibleSteps', product?.id, visibleSteps);

  // ---- Prefill once per open (NOT conditional hooks) ----
  const didPrefillRef = useRef(false);
  useEffect(() => {
    if (!open) {
      didPrefillRef.current = false;
      return;
    }
    if (didPrefillRef.current) return;
    if (!pid) return; // no product id, skip

    const match = existingMatch;

    if (match) {
      const q = parseInt(match.it.quantity) || 0;
      const stepIdx = visibleSteps.findIndex(s => parseInt(s.quantity) === q);
      if (stepIdx > -1) {
        // preset radio
        setSelectedIdx(stepIdx + 1);
        setCustomQty(''); // clear custom
        setError(null);
      } else {
        // custom
        setSelectedIdx(0);
        setCustomQty(String(q));
        if (q > 0 && q < minStep) setError(`הכמות המינימלית היא ${minStep}`);
      }
    } else {
      setError(null);
    }

    didPrefillRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    pid,
    cartItems,
    expectedMergeKey,
    filterWasChanged,
    placementSignature,
    visibleSteps,
    minStep,
  ]);

  // Total for this product currently in cart (all Quantity lines)
  const totalInCartForProduct = useMemo(() => {
    return (Array.isArray(cartItems) ? cartItems : []).reduce((sum, it) => {
      if (String(it?.product_id || '') !== pid) return sum;
      if (it?.pricing?.type === 'Quantity' || it?.options?.line_type === 'Quantity') {
        return sum + (parseInt(it.quantity) || 0);
      }
      return sum;
    }, 0);
  }, [cartItems, pid]);

  // "Other in cart" = total for this product in cart - qty of the matched line in cart
  // IMPORTANT: does NOT use the form-selected quantity, so it won't change while typing.
  const otherQtyInCart = useMemo(() => {
    const matchedQty = existingMatch ? parseInt(existingMatch.it?.quantity) || 0 : 0;
    return Math.max(0, (totalInCartForProduct || 0) - matchedQty);
  }, [totalInCartForProduct, existingMatch]);

  // ---- Submit: block invalid custom; then replace/remove/add ----
  const handleAddToCart = () => {
    if (isCustomSelected && (isCustomEmpty || isCustomTooLow)) {
      if (isCustomEmpty) setError(`הכמות המינימלית היא ${minStep}`);
      return;
    }
    if (!!error) return;

    const q = parseInt(quantity || 0) || 0;

    const existing = (Array.isArray(cartItems) ? cartItems : [])
      .map((it, index) => ({ it, index }))
      .find(({ it }) => {
        if (String(it?.product_id || '') !== pid) return false;
        if (it?.options?.line_type !== 'Quantity') return false;

        const mk = String(it?.options?.placement_merge_key || '');
        if (mk && mk === expectedMergeKey) return true;

        const sameSig =
          (filterWasChanged &&
            it?.filter_was_changed === true &&
            buildPlacementSignature(it?.placement_coordinates) === placementSignature) ||
          (!filterWasChanged && !it?.filter_was_changed);
        const sameSnap = !filterWasChanged
          ? true
          : normalizePlacementsForKey(it?.placement_coordinates) === expectedMergeKey;

        return sameSig && sameSnap;
      });

    if (existing) {
      if (q === 0) {
        removeItem(existing.index);
      } else {
        updateItemQuantity(existing.index, q);
      }
    } else if (q > 0) {
      addItem({
        product_id: safeProduct.id,
        name: safeProduct.name,
        thumbnail: safeProduct.thumbnail,
        thumbnail_meta: safeProduct.thumbnail_meta,
        quantity: q,
        price: unitWithExtra, // final unit (base + extra)
        price_base: unitBase, // store base for reprice
        extra_unit_add: extraEach, // per-unit extra for extra placements
        pricing: { type: 'Quantity', steps },
        placement_signature: placementSignature,
        placement_coordinates: effectivePlacements,
        product: { id: safeProduct.id, placement_coordinates: effectivePlacements },
        filter_was_changed: filterWasChanged,
        // mirror metadata for consistency
        baseline_active_count: baselineActive,
        selected_active_count: selectedActive,
        has_extra_selection: selectedActive > baselineActive,
        extra_print_price: Number(safeProduct?.extra_print_price) || 0,
        pricing_group_key:
          selectedActive > baselineActive ? `sig:${placementSignature}` : 'default',
        options: { line_type: 'Quantity', placement_merge_key: expectedMergeKey },
      });
    }

    if (typeof window !== 'undefined' && window.dataLayer && q > 0) {
      window.dataLayer.push({
        event: 'add_to_cart',
        ecommerce: {
          items: [{ item_id: safeProduct.id, item_name: safeProduct.name, unitBase, quantity: q }],
        },
      });
    }

    onCartAddSuccess?.();
    onClose();

    if (mode === 'temp' && filterWasChanged) {
      clearFilter(pid);
    }
  };

  // 🔒 Disable when custom is selected but empty or too-low, or any error exists
  const disableSubmit = !!error || (isCustomSelected && (isCustomEmpty || isCustomTooLow));
  /* ---------- Render continues below (unchanged) ---------- */

  // ---------- Render ----------
  // (No early return before hooks; guard text/values where product could be null)
  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) onClose?.(); // Radix guard
      }}
    >
      <DialogContent
        className="rounded-2xl shadow-xl p-0"
        style={{ width: '470px', minWidth: '470px', maxWidth: '100vw' }}
      >
        <DialogClose asChild>
          <button className="alarnd-close-btn" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </DialogClose>

        {/* Title centered */}
        <div className="mt-3 mb-1">
          <h2 className="text-xl font-bold text-center">{safeProduct.name || ''}</h2>
        </div>

        <div className="mb-4 flex flex-col gap-1">
          {/* Active areas — below title, flow left→right and wrap, capped width */}
          {activeAreaNames.length > 0 && (
            <div className="mx-auto max-w-[200px] flex flex-wrap justify-center gap-1">
              {activeAreaNames.map(nm => (
                <span
                  key={nm}
                  className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-600 text-emerald-700 bg-emerald-50"
                >
                  {nm}
                </span>
              ))}
            </div>
          )}

          {/* Other quantity in cart (stable; unaffected by form typing) */}
          {otherQtyInCart > 0 && (
            <div className="text-center text-xs text-gray-600">עוד {otherQtyInCart} בעגלה</div>
          )}
        </div>

        <form className="px-[30px] pb-[30px] pt-[10px]">
          <div className="flex flex-col gap-2">
            {/* Custom option row */}
            <label className={clsx('flex justify-between items-center gap-3 p-1 cursor-pointer')}>
              <div className="alarnd-single-qty flex-shrink-0">
                <input
                  type="radio"
                  name="quantity_choice"
                  checked={selectedIdx === 0}
                  onChange={() => setSelectedIdx(0)}
                  className="form-radio mx-2"
                />
                <input
                  className="custom_qty_input border rounded-lg px-2 py-1 w-24 text-right"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={visibleSteps.length ? `מינ' ${minStep}` : 'הקלידו כמות…'}
                  value={customQty}
                  onChange={e => {
                    if (selectedIdx !== 0) setSelectedIdx(0);
                    handleCustomQty(e.target.value);
                  }}
                  onFocus={() => setSelectedIdx(0)}
                  onClick={() => setSelectedIdx(0)}
                  onBlur={() => setError(null)}
                  maxLength={6}
                />
              </div>

              {/* Middle: total — only when custom selected AND valid */}
              <div className="alarnd-single-qty flex-1 text-center">
                <span className="text-gray-400">
                  {isCustomSelected && !isCustomEmpty && !isCustomTooLow
                    ? `${Math.round(customQtyNum * unitWithExtra)}₪`
                    : '—'}
                </span>
              </div>

              {/* Right: unit price — only when custom selected AND valid */}
              <div className="alarnd-single-qty flex-shrink-0">
                <span className="font-bold">
                  {isCustomSelected && !isCustomEmpty && !isCustomTooLow
                    ? `${unitWithExtra.toFixed(2)} ש״ח ליחידה`
                    : '—'}
                </span>
              </div>
            </label>

            {/* Preset step rows (unit includes pooled base + extraEach) */}
            {visibleSteps.map((step, idx) => {
              const stepQty = parseInt(step.quantity) || 0;
              const stepUnitBase = getPooledUnitBase(stepQty);
              const stepUnitWithExtra = stepUnitBase + extraEach;
              const stepTotal = Math.round(stepQty * stepUnitWithExtra);
              return (
                <label
                  key={idx + 1}
                  className={clsx('flex justify-between items-center gap-3 p-1 cursor-pointer')}
                >
                  <div className="alarnd-single-qty flex-shrink-0">
                    <input
                      type="radio"
                      name="quantity_choice"
                      checked={selectedIdx === idx + 1}
                      onChange={() => {
                        setSelectedIdx(idx + 1);
                        setCustomQty(''); // clear custom to avoid stale display
                        setError(null);
                      }}
                      className="form-radio mx-2"
                    />
                    <span className="font-semibold">{step.quantity}</span>
                  </div>

                  <div className="alarnd-single-qty flex-1 text-center">
                    <span className="text-gray-400">{stepTotal}₪</span>
                  </div>
                  <div className="alarnd-single-qty flex-shrink-0">
                    <span className="font-bold">{stepUnitWithExtra.toFixed(2)} ש״ח ליחידה</span>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Inline hint when custom selected but not valid */}
          {isCustomSelected && (isCustomEmpty || isCustomTooLow) && !error && (
            <div className="text-amber-600 text-sm text-center mt-2">
              נא להזין לפחות {minStep} יחידות.
            </div>
          )}
          {error && <div className="text-red-500 text-sm text-center mt-2">{error}</div>}

          <div className="text-center mt-4">
            <button
              type="button"
              disabled={disableSubmit}
              className={clsx(
                'alarnd-btn w-auto',
                disableSubmit && 'opacity-50 cursor-not-allowed'
              )}
              onClick={handleAddToCart}
            >
              הוסף לעגלה
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
