// src/components/page/AddToCartQuantity.jsx
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import clsx from 'clsx';
import { applyBumpPrice } from '@/utils/price';
import { X } from 'lucide-react';
import { useCartStore } from '@/components/cart/cartStore';
import { useAreaFilterStore } from '@/components/cart/areaFilterStore';

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

  // ---- Pricing helpers (lint-safe) ----
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

  const minStep = visibleSteps[0] ? parseInt(visibleSteps[0].quantity) : 1;
  const customQtyNum = parseInt(customQty || 0) || 0;
  const isCustomSelected = selectedIdx === 0;
  const isCustomEmpty = isCustomSelected && customQty === '';
  const isCustomTooLow = isCustomSelected && customQty !== '' && customQtyNum < minStep;

  const customPricing = useMemo(() => {
    if (!isCustomSelected || isCustomEmpty || isCustomTooLow) {
      return { unitPrice: 0, total: 0 };
    }
    const unitPrice = getPriceForQuantity(customQtyNum);
    const total = customQtyNum * unitPrice;
    return { unitPrice, total };
  }, [isCustomSelected, isCustomEmpty, isCustomTooLow, customQtyNum, getPriceForQuantity]);

  const { quantity, price } = useMemo(() => {
    if (isCustomSelected) {
      const q = isCustomEmpty ? 0 : customQtyNum;
      const p = getPriceForQuantity(q);
      return { quantity: q, price: p };
    } else {
      const idx = selectedIdx - 1;
      return {
        quantity: visibleSteps[idx] ? parseInt(visibleSteps[idx].quantity || 0) : 0,
        price: visibleSteps[idx] ? parseFloat(visibleSteps[idx].amount || 0) : 0,
      };
    }
  }, [
    isCustomSelected,
    isCustomEmpty,
    customQtyNum,
    selectedIdx,
    visibleSteps,
    getPriceForQuantity,
  ]);

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
  let baselinePlacements = [];
  if (pagePlacementMap && typeof pagePlacementMap === 'object' && pid in pagePlacementMap) {
    baselinePlacements = coercePlacementArray(pagePlacementMap[pid], safeProduct?.id);
  } else {
    baselinePlacements = coercePlacementArray(
      safeProduct?.meta?.placement_coordinates ?? safeProduct?.acf?.placement_coordinates ?? [],
      safeProduct?.id
    );
  }
  const placementSignature = buildPlacementSignature(effectivePlacements);
  const baselineSignature = buildPlacementSignature(baselinePlacements);
  const filterWasChanged = placementSignature !== baselineSignature;
  const expectedMergeKey = filterWasChanged
    ? normalizePlacementsForKey(effectivePlacements)
    : 'default';

  // ---- Prefill once per open (NOT conditional hooks) ----
  const didPrefillRef = useRef(false);
  useEffect(() => {
    if (!open) {
      didPrefillRef.current = false;
      return;
    }
    if (didPrefillRef.current) return;
    if (!pid) return; // no product id, skip

    const match = (Array.isArray(cartItems) ? cartItems : [])
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
        quantity: q,
        price,
        pricing: { type: 'Quantity', steps },
        placement_signature: placementSignature,
        placement_coordinates: effectivePlacements,
        product: { id: safeProduct.id, placement_coordinates: effectivePlacements },
        filter_was_changed: filterWasChanged,
        options: {
          line_type: 'Quantity',
          placement_merge_key: expectedMergeKey,
        },
      });
    }

    if (typeof window !== 'undefined' && window.dataLayer && q > 0) {
      window.dataLayer.push({
        event: 'add_to_cart',
        ecommerce: {
          items: [{ item_id: safeProduct.id, item_name: safeProduct.name, price, quantity: q }],
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

        <h2 className="text-xl font-bold text-center mb-4 mt-3">{safeProduct.name || ''}</h2>

        <form className="p-[30px]">
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
                    ? `${Math.round(customPricing.total)}₪`
                    : '—'}
                </span>
              </div>

              {/* Right: unit price — only when custom selected AND valid */}
              <div className="alarnd-single-qty flex-shrink-0">
                <span className="font-bold">
                  {isCustomSelected && !isCustomEmpty && !isCustomTooLow
                    ? `${customPricing.unitPrice} ש״ח ליחידה`
                    : '—'}
                </span>
              </div>
            </label>

            {/* Preset step rows */}
            {visibleSteps.map((step, idx) => (
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
                  <span className="text-gray-400">
                    {Math.round(parseFloat(step.quantity) * parseFloat(step.amount))}₪
                  </span>
                </div>
                <div className="alarnd-single-qty flex-shrink-0">
                  <span className="font-bold">{step.amount} ש״ח ליחידה</span>
                </div>
              </label>
            ))}
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
