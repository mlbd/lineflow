import { useState, useMemo, useLayoutEffect } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import clsx from 'clsx';
import { applyBumpPrice, applyBumpToRegular } from '@/utils/price';
import { X } from 'lucide-react';
import { useCartStore } from '@/components/cart/cartStore';
import { useAreaFilterStore } from '@/components/cart/areaFilterStore';

const toNumber = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

function getLuminance(hex) {
  hex = hex?.replace(/^#/, '') || '';
  if (hex.length === 3)
    hex = hex
      .split('')
      .map(x => x + x)
      .join('');
  const num = parseInt(hex || '0', 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function isDarkColor(hex) {
  return getLuminance(hex) < 140;
}

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

const QTY_LIMIT = 999;

function useResponsiveModalWidth(sizes, minPad = 32) {
  const [computedWidth, setComputedWidth] = useState(950);
  useLayoutEffect(() => {
    function updateWidth() {
      const base = sizes.length * (62 + 5) + 158;
      const maxWidth = Math.min(950, window.innerWidth - minPad);
      setComputedWidth(Math.min(base, maxWidth));
    }
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [sizes.length, minPad]);
  return computedWidth;
}

function getStepPrice(total, regularPrice, discountSteps = []) {
  let price = toNumber(regularPrice);
  let lastStepQty = 0;
  for (const step of discountSteps) {
    const q = toNumber(step.quantity);
    if (total >= q) {
      const amt = toNumber(step.amount);
      price = amt;
      lastStepQty = q;
    }
  }
  return { price, lastStepQty };
}

// Parse pagePlacementMap entry (array | JSON string | keyed object)
const parseMaybeArray = val => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

export default function AddToCartGroup({
  open,
  onClose,
  product,
  bumpPrice,
  onOpenQuickView,
  onCartAddSuccess,
  pagePlacementMap = {},
}) {
  const acf = product?.acf || {};
  const sizes = (acf.omit_sizes_from_chart || []).map(s => s.value);
  const colors = acf.color || [];
  const rawRegular = applyBumpToRegular(acf.regular_price || product?.price || '0', bumpPrice);
  const regularPrice = toNumber(rawRegular);
  const discountSteps = applyBumpPrice(acf.discount_steps || [], bumpPrice);

  const computedWidth = useResponsiveModalWidth(sizes);
  const dialogPadding = 100;
  const modalWidth = computedWidth + dialogPadding;

  const [quantities, setQuantities] = useState(() => colors.map(() => sizes.map(() => '')));
  const [error, setError] = useState(null);

  const filters = useAreaFilterStore(s => s.filters);
  const clearFilter = useAreaFilterStore(s => s.clearFilter);
  const mode = useAreaFilterStore(s => s.mode);

  console.log("mode", mode);

  const { total, stepInfo } = useMemo(() => {
    let t = 0;
    for (const row of quantities) for (const val of row) t += parseInt(val || 0);
    const { price, lastStepQty } = getStepPrice(t, regularPrice, discountSteps);
    return { total: t, stepInfo: { price, lastStepQty } };
  }, [quantities, discountSteps, regularPrice]);

  const nextStep = discountSteps.find(s => parseInt(s.quantity) > total);
  const unitsToNext =
    nextStep && parseInt(nextStep.quantity) - total > 0
      ? parseInt(nextStep.quantity) - total
      : null;

  const addOrUpdateItem = useCartStore(s => s.addOrUpdateItem);

  const handleInput = (colorIdx, sizeIdx, val) => {
    let newVal = val.replace(/[^0-9]/g, '');
    if (newVal.length > 1 && newVal[0] === '0') newVal = newVal.replace(/^0+/, '');
    if (parseInt(newVal) > QTY_LIMIT) {
      setError(`כמות מקסימלית לרכישה: ${QTY_LIMIT}`);
      newVal = QTY_LIMIT.toString();
    } else setError(null);

    setQuantities(prev =>
      prev.map((row, rIdx) =>
        rIdx === colorIdx ? row.map((col, cIdx) => (cIdx === sizeIdx ? newVal : col)) : row
      )
    );
  };

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

  const handleAddToCart = () => {
    if (total === 0) return;

    const pid = String(product?.id || '');

    // Start with product-provided placements
    let effectivePlacements = Array.isArray(product?.placement_coordinates)
      ? product.placement_coordinates
      : [];

    // 1. If user has changed filter for this product → take that as top priority
    if (filters && filters[pid] && Array.isArray(filters[pid])) {
      effectivePlacements = filters[pid];
    }

    // 2. Else, if pagePlacementMap has an override for this product → use that
    else if (
      pagePlacementMap &&
      typeof pagePlacementMap === 'object' &&
      !Array.isArray(pagePlacementMap) &&
      pagePlacementMap[pid]
    ) {
      effectivePlacements = coercePlacementArray(pagePlacementMap[pid], product?.id);
    }

    // Baseline = pagePlacementMap override (if exists) OR product defaults
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

    // Step 1: Collect all cart entries to add (FREEZE the effective placements)
    const itemsToAdd = [];

    colors.forEach((color, rIdx) => {
      sizes.forEach((size, cIdx) => {
        const qty = parseInt(quantities[rIdx][cIdx] || 0);
        if (qty > 0) {
          itemsToAdd.push({
            product_id: product.id,
            name: product.name,

            thumbnail: product.thumbnail,

            price: Number(stepInfo.price) || 0,
            quantity: qty,

            pricing: {
              type: 'Group',
              regular_price: Number(regularPrice),
              discount_steps: discountSteps,
            },

            // (kept for debugging/compat; cartStore derives its own signature)
            placement_signature: placementSignature,

            // ✅ FROZEN placements snapshot (effective)
            placement_coordinates: effectivePlacements,

            product: {
              id: product.id,
              placement_coordinates: effectivePlacements,
              acf: {
                color: Array.isArray(product?.acf?.color) ? product.acf.color : [],
              },
            },

            // ✅ correct flag for cart (merging + UI)
            filter_was_changed: filterWasChanged,

            options: {
              group_type: 'Group',
              color: color.title,
              color_hex_code: color.color_hex_code,
              size,
              color_thumbnail_url: color?.thumbnail?.url || '',
            },
          });
        }
      });
    });

    itemsToAdd.forEach(item => {
      addOrUpdateItem(item);
    });

    if (typeof window !== 'undefined' && window.dataLayer) {
      itemsToAdd.forEach(item => {
        window.dataLayer.push({
          event: 'add_to_cart',
          ecommerce: {
            items: [
              {
                item_id: item.product_id,
                item_name: item.name,
                price: item.price,
                quantity: item.quantity,
                item_color: item.options.color,
                item_size: item.options.size,
              },
            ],
          },
        });
      });
    }

    if (onCartAddSuccess) onCartAddSuccess();
    onClose();

    if(mode === 'temp' && filterWasChanged) {
      clearFilter(pid);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="rounded-2xl shadow-xl"
        style={{
          width: `${modalWidth}px`,
          minWidth: `600px`,
          maxWidth: '100vw',
          padding: '20px 50px 30px',
          transition: 'width 0.2s cubic-bezier(.42,0,.58,1)',
        }}
      >
        <DialogClose asChild>
          <button className="alarnd-close-btn" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </DialogClose>

        <div>
          <h2 className="text-xl font-bold text-center mb-4 mt-3">{product.name}</h2>
        </div>

        <form className="flex items-center flex-col relative allaround--group-form">
          <div
            className={clsx(
              'overflow-x-auto overflow-y-auto rounded-lg bg-white mb-4',
              'scrollbar-thin allaround-scrollbar'
            )}
            style={{
              width: `${computedWidth}px`,
              minWidth: `300px`,
              maxHeight: '357px',
              transition: 'width 0.2s cubic-bezier(.42,0,.58,1)',
            }}
          >
            <div className="w-full bg-white sticky top-0 z-10 sticky-top-size-ttile">
              <div className="flex items-center">
                <div className="w-[110px] min-w-[110px] h-[52px] bg-white px-2 flex items-center"></div>
                <div className="flex flow gap-[10px] pl-2 flex-1">
                  {sizes.map((size, cIdx) => (
                    <div key={cIdx} className="block flex-1 py-1.5">
                      <div className="w-full text-center font-regular py-2 text-base bg-bglight">
                        {size}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full">
              {colors.map((color, rIdx) => {
                const bg = color.color_hex_code || '#fff';
                const dark = isDarkColor(bg);
                return (
                  <div key={rIdx} className="flex items-center" style={{ borderColor: '#eee' }}>
                    <div className="w-[110px] min-w-[110px] px-2 flex items-center">
                      <span
                        className={clsx(
                          'inline-block border',
                          'text-[16px] font-medium px-[10px] leading-[2] py-[5px] rounded-[5px]',
                          'border-[#ccc]',
                          dark ? 'text-white' : 'text-[#222]'
                        )}
                        style={{ background: bg, width: '100%', textAlign: 'center' }}
                      >
                        {color.title}
                      </span>
                    </div>
                    <div className="flex gap-[10px] pl-2 flex-1">
                      {sizes.map((size, cIdx) => (
                        <div key={cIdx} className="block flex-1 py-1.5">
                          <input
                            className={clsx(
                              'text-center outline-none',
                              'border border-[#ccc] rounded-[6px] bg-white text-[#222222]',
                              'text-sm leading-[2] py-[5px] px-[6px]',
                              'w-full',
                              'focus:ring focus:ring-skyblue',
                              error && 'border-red-400'
                            )}
                            style={{ boxShadow: `0px 0px 0px 1px ${bg}` }}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={3}
                            value={quantities[rIdx][cIdx]}
                            onChange={e => handleInput(rIdx, cIdx, e.target.value)}
                            onBlur={() => setError(null)}
                            autoComplete="off"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-full">
            {error ? (
              <div className="text-red-500 text-sm text-center mb-2">{error}</div>
            ) : unitsToNext ? (
              <div className="text-pink text-xl pt-[10px] text-center mb-2 flex flex-col">
                <span>
                  הוסיפו {unitsToNext} פריטים נוספים להורדת המחיר ל-{' '}
                  <b>{nextStep.amount || regularPrice}₪</b> ליחידה
                </span>
                <span className="line-through">(כרגע {stepInfo.price}₪)</span>
              </div>
            ) : (
              total > 0 && (
                <div className="text-green-600 text-center mb-2">
                  {`מחיר ליחידה: ${stepInfo.price}₪`}
                </div>
              )
            )}

            <div className="flex justify-between items-center">
              <div className="flex-shrink-0">
                <button
                  type="button"
                  className="trigger-view-modal-btn alarnd-btn"
                  onClick={() => onOpenQuickView && onOpenQuickView(product)}
                >
                  Quick View
                </button>
              </div>
              <div className="flex-1 text-center">
                <div className="alarnd--price-by-shirt text-center my-4">
                  <p className="alarnd--group-price text-lg font-semibold">
                    <span>
                      <span className="alarnd__wc-price">{stepInfo.price}</span>
                      <span className="woocommerce-Price-currencySymbol">₪</span>
                    </span>{' '}
                    / {acf.first_line_keyword || 'תיק'}
                  </p>
                  <p>
                    סה&quot;כ יחידות: <span className="alarnd__total_qty">{total}</span>
                  </p>
                  <span className="alarnd--total-price">
                    סה&quot;כ:{' '}
                    <span>
                      <span className="alarnd__wc-price">{total * stepInfo.price}</span>
                      <span className="woocommerce-Price-currencySymbol">₪</span>
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <button
                  type="button"
                  disabled={total === 0}
                  className="alarnd-btn"
                  onClick={handleAddToCart}
                >
                  הוסף לעגלה
                </button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
