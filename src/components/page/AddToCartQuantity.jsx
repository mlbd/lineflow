// AddToCartQuantity.jsx
import { useState, useMemo } from 'react';
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

/** Create a stable, order-insensitive string key for exact placement equality.
 * Includes: name, active, xPercent,yPercent,wPercent,hPercent,rotate (rounded).
 */
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
    // sort by name first (then x,y,w,h,r) so array order won’t affect equality
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
  // -------- All hooks must be called at the top --------
  const acf = product?.acf || {};
  const steps = applyBumpPrice(acf.quantity_steps || [], bumpPrice);

  const minStep = steps[0] ? parseInt(steps[0].quantity) : 1;
  const [selectedIdx, setSelectedIdx] = useState(1);
  const [customQty, setCustomQty] = useState('');
  const [error, setError] = useState(null);

  const addItem = useCartStore(s => s.addItem);

  // Area filter store (for resolving effective placements + optional clear)
  const filters = useAreaFilterStore(s => s.filters);
  const clearFilter = useAreaFilterStore(s => s.clearFilter);
  const mode = useAreaFilterStore(s => s.mode);

  const sizeWidth = 470;

  const getPriceForQuantity = qty => {
    if (!qty || !steps.length) return 0;
    const visibleSteps = steps.filter(step => !step.hide);
    let applicableStep = visibleSteps[0];
    for (const step of visibleSteps) {
      if (qty >= parseInt(step.quantity)) applicableStep = step;
      else break;
    }
    return applicableStep ? parseFloat(applicableStep.amount) : 0;
  };

  const customPricing = useMemo(() => {
    const qty = parseInt(customQty || 0);
    if (!qty) return { unitPrice: 0, total: 0 };
    const unitPrice = getPriceForQuantity(qty);
    const total = qty * unitPrice;
    return { unitPrice, total };
  }, [customQty, steps]);

  const { quantity, price } = useMemo(() => {
    if (selectedIdx === 0) {
      const q = parseInt(customQty || 0);
      const p = getPriceForQuantity(q);
      return { quantity: q, price: p };
    } else {
      const idx = selectedIdx - 1;
      return {
        quantity: steps[idx] ? parseInt(steps[idx].quantity || 0) : 0,
        price: steps[idx] ? parseFloat(steps[idx].amount || 0) : 0,
      };
    }
  }, [selectedIdx, customQty, steps]);

  if (!product) return null;

  const handleCustomQty = val => {
    let newVal = val.replace(/[^0-9]/g, '');
    if (parseInt(newVal) > QTY_LIMIT) {
      setError(`כמות מקסימלית לרכישה: ${QTY_LIMIT}`);
    } else if (newVal && parseInt(newVal) < minStep) {
      setError(`הכמות המינימלית היא ${minStep}`);
    } else {
      setError(null);
    }
    setCustomQty(newVal);
  };

  // --- Add to Cart Handler: FREEZE placements + merge/split like Group ---
  const handleAddToCart = () => {
    if (!quantity || !!error) return;

    const pid = String(product?.id || '');

    // Start with product placements
    let effectivePlacements = Array.isArray(product?.placement_coordinates)
      ? product.placement_coordinates
      : [];

    // 1) User filter wins
    if (filters && filters[pid] && Array.isArray(filters[pid])) {
      effectivePlacements = filters[pid];
    }
    // 2) Else page override
    else if (
      pagePlacementMap &&
      typeof pagePlacementMap === 'object' &&
      !Array.isArray(pagePlacementMap) &&
      pagePlacementMap[pid]
    ) {
      effectivePlacements = coercePlacementArray(pagePlacementMap[pid], product?.id);
    }

    // Baseline for comparison (page map takes precedence if available)
    let baselinePlacements = [];
    if (
      pagePlacementMap &&
      typeof pagePlacementMap === 'object' &&
      !Array.isArray(pagePlacementMap) &&
      pid in pagePlacementMap
    ) {
      baselinePlacements = coercePlacementArray(pagePlacementMap[pid], product?.id);
    } else {
      baselinePlacements = coercePlacementArray(
        product?.meta?.placement_coordinates ?? product?.acf?.placement_coordinates ?? [],
        product?.id
      );
    }

    const placementSignature = buildPlacementSignature(effectivePlacements);
    const baselineSignature = buildPlacementSignature(baselinePlacements);
    const filterWasChanged = placementSignature !== baselineSignature;

    // === NEW: “Group-like” merge behavior for Quantity ===
    // If filter wasn’t changed → force all to merge under 'default'
    // If changed → merge only when exact placement_coordinates match
    const mergeKey = filterWasChanged ? normalizePlacementsForKey(effectivePlacements) : 'default';

    // Freeze snapshot on the cart line (and inside product for generators)
    addItem({
      product_id: product.id,
      name: product.name,
      thumbnail: product.thumbnail,
      quantity,
      price,
      pricing: { type: 'Quantity', steps },
      placement_signature: placementSignature,
      placement_coordinates: effectivePlacements, // FROZEN snapshot
      product: {
        id: product.id,
        placement_coordinates: effectivePlacements, // FROZEN snapshot for generators
      },
      filter_was_changed: filterWasChanged,
      // The store merges non-group by product_id + JSON.stringify(options)
      // So we inject a deterministic key to control merge/split behavior.
      options: {
        line_type: 'Quantity',
        placement_merge_key: mergeKey,
      },
    });

    if (typeof window !== 'undefined' && window.dataLayer) {
      window.dataLayer.push({
        event: 'add_to_cart',
        ecommerce: {
          items: [{ item_id: product.id, item_name: product.name, price, quantity }],
        },
      });
    }

    onCartAddSuccess?.();
    onClose();

    // Optional: clear temp filters if we used them
    if (mode === 'temp' && filterWasChanged) {
      clearFilter(pid);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="rounded-2xl shadow-xl p-0"
        style={{ width: '470px', minWidth: '470px', maxWidth: '100vw' }}
      >
        <DialogClose asChild>
          <button className="alarnd-close-btn" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </DialogClose>
        <h2 className="text-xl font-bold text-center mb-4 mt-3">{product.name}</h2>
        <form className="p-[30px]">
          <div className="flex flex-col gap-2">
            {/* Custom input option first */}
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
                  placeholder="הקלידו כמות…"
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

              {/* Middle column: total */}
              <div className="alarnd-single-qty flex-1 text-center">
                <span className="text-gray-400">
                  {customQty && parseInt(customQty) > 0
                    ? `${Math.round(customPricing.total)}₪`
                    : '—'}
                </span>
              </div>

              {/* Right column: unit price */}
              <div className="alarnd-single-qty flex-shrink-0">
                <span className="font-bold">
                  {customQty && parseInt(customQty) > 0
                    ? `${customPricing.unitPrice} ש״ח ליחידה`
                    : '—'}
                </span>
              </div>
            </label>

            {/* Preset steps */}
            {steps
              .filter(step => !step.hide)
              .map((step, idx) => (
                <label
                  key={idx + 1}
                  className={clsx('flex justify-between items-center gap-3 p-1 cursor-pointer')}
                >
                  <div className="alarnd-single-qty flex-shrink-0">
                    <input
                      type="radio"
                      name="quantity_choice"
                      checked={selectedIdx === idx + 1}
                      onChange={() => setSelectedIdx(idx + 1)}
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
          {error && <div className="text-red-500 text-sm text-center mt-2">{error}</div>}
          <div className="text-center mt-4">
            <button
              type="button"
              disabled={!quantity || !!error}
              className="alarnd-btn w-auto"
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
