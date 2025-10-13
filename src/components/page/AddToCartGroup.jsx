// !fullupdate
import { useState, useMemo, useLayoutEffect, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import clsx from 'clsx';
import { applyBumpPrice, applyBumpToRegular } from '@/utils/price';
import { X } from 'lucide-react';
import { useCartStore } from '@/components/cart/cartStore';
import { useAreaFilterStore } from '@/components/cart/areaFilterStore';
import { buildPlacementSignature } from '@/utils/placements';
import ProductRightColumn from '@/components/page/ProductRightColumn';

// Cache the first non-empty baseline per product id, so user filters can't mutate it later.
const __baselinePlacementCache =
  typeof window !== 'undefined' ? (window.__baselinePlacementCache ||= new Map()) : new Map();

const toNumber = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/[^\d.-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

// money helpers
const fmt2 = cents => (Math.max(0, Number(cents || 0)) / 100).toFixed(2);

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

function resolveStepPricing(total, regularPrice, discountSteps = []) {
  const reg = toNumber(regularPrice);
  const steps = (Array.isArray(discountSteps) ? discountSteps : [])
    .map(s => ({ quantity: toNumber(s.quantity), amount: toNumber(s.amount) }))
    .filter(s => s.quantity > 0)
    .sort((a, b) => a.quantity - b.quantity);

  if (!steps.length) return { price: reg, currentIdx: -1, nextStep: null, unitsToNext: null };

  let currentIdx = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    if (total <= steps[i].quantity) {
      currentIdx = i;
      break;
    }
  }

  const current = steps[currentIdx];
  const price = current.amount > 0 ? current.amount : reg;

  const nextIdx = currentIdx + 1;
  if (nextIdx >= steps.length) return { price, currentIdx, nextStep: null, unitsToNext: null };

  const next = steps[nextIdx];
  const nextTierMin = steps[currentIdx].quantity + 1;
  const unitsToNext = Math.max(0, nextTierMin - total);
  const nextDisplayAmt = next.amount > 0 ? next.amount : reg;

  return { price, currentIdx, nextStep: { ...next, amount: nextDisplayAmt }, unitsToNext };
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

// signature used in cart merge
const effectiveSigForCartItem = it => {
  return it?.options?.group_type === 'Group'
    ? it?.filter_was_changed
      ? buildPlacementSignature(it?.placement_coordinates)
      : 'default'
    : '';
};

export default function AddToCartGroup({
  open,
  onClose,
  product,
  bumpPrice,
  onOpenQuickView,
  onCartAddSuccess,
  pagePlacementMap = {},
  companyLogos = {},
  customBackAllowedSet = {},
}) {
  const acf = product?.acf || {};
  const sizes = (acf.omit_sizes_from_chart || []).map(s => s.value);
  const colors = acf.color || [];
  const rawRegular = applyBumpToRegular(acf.regular_price || product?.price || '0', bumpPrice);
  const regularPrice = toNumber(rawRegular);
  const discountSteps = applyBumpPrice(acf.discount_steps || [], bumpPrice);

  const computedWidth = useResponsiveModalWidth(sizes);
  const dialogPadding = 100;

  const [quantities, setQuantities] = useState(() => colors.map(() => sizes.map(() => '')));
  const [error, setError] = useState(null);

  const filters = useAreaFilterStore(s => s.filters);
  const clearFilter = useAreaFilterStore(s => s.clearFilter);
  const mode = useAreaFilterStore(s => s.mode);

  // Local matrix total
  const localTotal = useMemo(() => {
    let t = 0;
    for (const row of quantities) for (const val of row) t += parseInt(val || 0);
    return t;
  }, [quantities]);

  // cart store fns
  const addOrUpdateItem = useCartStore(s => s.addOrUpdateItem);
  const cartItems = useCartStore(s => s.items);
  const updateItemQuantity = useCartStore(s => s.updateItemQuantity);
  const removeItem = useCartStore(s => s.removeItem);

  const handleInput = (colorIdx, sizeIdx, val) => {
    let newVal = val.replace(/[^0-9]/g, '');
    if (newVal.length > 1 && newVal[0] === '0') newVal = newVal.replace(/^0+/, '');
    if (parseInt(newVal) > QTY_LIMIT) {
      setError(`Maximum quantity per order: ${QTY_LIMIT}`);
      newVal = QTY_LIMIT.toString();
    } else setError(null);

    setQuantities(prev =>
      prev.map((row, rIdx) =>
        rIdx === colorIdx ? row.map((col, cIdx) => (cIdx === sizeIdx ? newVal : col)) : row
      )
    );
  };

  // —— Effective placements
  const pid = String(product?.id || '');
  const effectivePlacements = useMemo(() => {
    let eff = Array.isArray(product?.placement_coordinates) ? product.placement_coordinates : [];
    if (filters && filters[pid] && Array.isArray(filters[pid])) {
      eff = filters[pid];
    } else if (
      pagePlacementMap &&
      typeof pagePlacementMap === 'object' &&
      !Array.isArray(pagePlacementMap) &&
      pagePlacementMap[pid]
    ) {
      eff = coercePlacementArray(pagePlacementMap[pid], product?.id);
    }
    return eff;
  }, [product?.placement_coordinates, product?.id, filters, pid, pagePlacementMap]);

  const activePlacementsUI = useMemo(
    () =>
      (Array.isArray(effectivePlacements) ? effectivePlacements : [])
        .filter(p => p?.active && p?.name)
        .map(p => ({
          name: String(p.name),
          forceBack: !!p.__forceBack,
          extraPrice: !!p.extraPrice,
        })),
    [effectivePlacements]
  );

  // —— Baseline placements (cached per product id)
  const baselinePlacementsRef = useMemo(() => {
    const key = String(product?.id || '');
    const cached = __baselinePlacementCache.get(key);
    if (cached && Array.isArray(cached) && cached.length) return cached;
    const raw = Array.isArray(product?.placement_coordinates)
      ? product.placement_coordinates
      : coercePlacementArray(product?.placement_coordinates, product?.id);
    const hasActive = Array.isArray(raw) && raw.some(p => p?.active);
    if (hasActive) {
      const clone = JSON.parse(JSON.stringify(raw));
      __baselinePlacementCache.set(key, clone);
      return clone;
    }
    return Array.isArray(raw) ? raw : [];
  }, [product?.id]);

  const placementSignature = useMemo(
    () => buildPlacementSignature(effectivePlacements),
    [effectivePlacements]
  );
  const baselineSignature = useMemo(
    () => buildPlacementSignature(baselinePlacementsRef),
    [product?.id]
  );
  const filterWasChanged = placementSignature !== baselineSignature;

  // ----- Price preview: pooled quantity across cart -----
  const placementSignatureForPrice = useMemo(
    () => buildPlacementSignature(effectivePlacements),
    [effectivePlacements]
  );
  const baselineSignatureForPrice = useMemo(
    () => buildPlacementSignature(baselinePlacementsRef),
    [product?.id]
  );
  const filterWasChangedForPrice = placementSignatureForPrice !== baselineSignatureForPrice;
  const expectedSigForPrice = filterWasChangedForPrice ? placementSignatureForPrice : 'default';

  const { cartAllQtyForPrice, cartThisSigQtyForPrice } = useMemo(() => {
    let all = 0;
    let thisSig = 0;
    (Array.isArray(cartItems) ? cartItems : []).forEach(it => {
      if (String(it?.product_id || '') !== pid) return;
      if (it?.options?.group_type !== 'Group') return;
      const q = parseInt(it.quantity) || 0;
      all += q;
      const sig = effectiveSigForCartItem(it);
      if (sig === expectedSigForPrice) thisSig += q;
    });
    return { cartAllQtyForPrice: all, cartThisSigQtyForPrice: thisSig };
  }, [cartItems, pid, expectedSigForPrice]);

  const previewPooledTotal = useMemo(
    () => Math.max(0, cartAllQtyForPrice - cartThisSigQtyForPrice) + localTotal,
    [cartAllQtyForPrice, cartThisSigQtyForPrice, localTotal]
  );

  const stepInfo = useMemo(
    () => resolveStepPricing(previewPooledTotal, regularPrice, discountSteps),
    [previewPooledTotal, regularPrice, discountSteps]
  );

  const otherQtyInCart = useMemo(
    () => Math.max(0, (cartAllQtyForPrice || 0) - (cartThisSigQtyForPrice || 0)),
    [cartAllQtyForPrice, cartThisSigQtyForPrice]
  );

  const countActive = arr => (Array.isArray(arr) ? arr.filter(p => p?.active).length : 0);
  const baselineActiveCount = useMemo(() => countActive(baselinePlacementsRef), [product?.id]);
  const selectedActiveCount = useMemo(
    () => countActive(effectivePlacements),
    [effectivePlacements]
  );
  const extraPricePlaceCount = useMemo(
    () => Math.max(0, Number(selectedActiveCount || 0) - 1),
    [selectedActiveCount]
  );
  const extraPrint = useMemo(
    () => Math.max(0, toNumber(product?.extra_print_price)),
    [product?.extra_print_price]
  );
  const extraEach = useMemo(
    () => extraPricePlaceCount * extraPrint,
    [extraPricePlaceCount, extraPrint]
  );
  const unitWithExtra = useMemo(
    () => toNumber(stepInfo.price) + extraEach,
    [stepInfo.price, extraEach]
  );
  const hasExtraSelection = extraPricePlaceCount > 0 && extraPrint > 0;
  const nextStepAmountWithExtra = useMemo(
    () => (stepInfo?.nextStep ? Number(stepInfo.nextStep.amount) + extraEach : 0),
    [stepInfo?.nextStep, extraEach]
  );

  // —— PRE-FILL GRID from cart if same product + same signature ——
  const prefillMatrix = useMemo(() => {
    const expectedSig = filterWasChanged ? placementSignature : 'default';
    const base = colors.map(() => sizes.map(() => ''));
    const colorIndex = new Map(colors.map((c, i) => [String(c.title), i]));
    const sizeIndex = new Map(sizes.map((s, i) => [String(s), i]));

    (Array.isArray(cartItems) ? cartItems : [])
      .filter(
        it =>
          String(it?.product_id || '') === pid &&
          it?.options?.group_type === 'Group' &&
          effectiveSigForCartItem(it) === expectedSig
      )
      .forEach(it => {
        const r = colorIndex.get(String(it?.options?.color || ''));
        const c = sizeIndex.get(String(it?.options?.size || ''));
        if (r != null && c != null) {
          const prev = parseInt(base[r][c] || 0);
          const add = parseInt(it.quantity || 0);
          base[r][c] = String(prev + add);
        }
      });

    return base;
  }, [cartItems, colors, sizes, pid, filterWasChanged, placementSignature]);

  // ✅ Initialize once per open
  const didPrefillRef = useRef(false);
  useEffect(() => {
    if (open && !didPrefillRef.current) {
      setQuantities(prefillMatrix);
      didPrefillRef.current = true;
    }
    if (!open) didPrefillRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // —— REPLACE semantics on submit ——
  const handleAddToCart = () => {
    const flatTotal = quantities.flat().reduce((s, v) => s + (parseInt(v || 0) || 0), 0);
    if (flatTotal === 0) {
      const expectedSig = filterWasChanged ? placementSignature : 'default';
      const now = useCartStore.getState().items;
      const matches = now
        .map((it, idx) => ({ it, idx }))
        .filter(
          ({ it }) =>
            String(it?.product_id || '') === pid &&
            it?.options?.group_type === 'Group' &&
            effectiveSigForCartItem(it) === expectedSig
        )
        .map(({ idx }) => idx)
        .sort((a, b) => b - a);
      matches.forEach(i => removeItem(i));
      onCartAddSuccess?.();
      onClose();

      try {
        const resetAll = useAreaFilterStore.getState().resetAll;
        resetAll?.();
      } catch {}

      if (mode === 'temp' && filterWasChanged) clearFilter(pid);
      return;
    }

    const placement_signature = filterWasChanged ? placementSignature : 'default';
    const expectedSig = placement_signature;

    const colorIndex = new Map(colors.map((c, i) => [String(c.title), i]));
    const sizeIndex = new Map(sizes.map((s, i) => [String(s), i]));

    const now = useCartStore.getState().items;
    const existing = now
      .map((it, idx) => ({ it, idx }))
      .filter(
        ({ it }) =>
          String(it?.product_id || '') === pid &&
          it?.options?.group_type === 'Group' &&
          effectiveSigForCartItem(it) === expectedSig
      );

    const keyOf = (color, size) => `${String(color)}|${String(size)}`;
    const existMap = new Map();
    for (const { it, idx } of existing) {
      existMap.set(keyOf(it?.options?.color, it?.options?.size), {
        idx,
        qty: parseInt(it.quantity) || 0,
      });
    }

    const updates = [];
    const removals = [];
    const additions = [];

    colors.forEach((color, rIdx) => {
      sizes.forEach((size, cIdx) => {
        const newQty = parseInt(quantities[rIdx][cIdx] || 0) || 0;
        const k = keyOf(color.title, size);

        if (existMap.has(k)) {
          const { idx, qty: oldQty } = existMap.get(k);
          if (newQty === 0) {
            removals.push(idx);
          } else if (newQty !== oldQty) {
            updates.push({ idx, qty: newQty });
          }
        } else {
          if (newQty > 0) {
            additions.push({
              product_id: product.id,
              name: product.name,
              thumbnail: product.thumbnail,
              thumbnail_meta: product.thumbnail_meta,
              price: Number(unitWithExtra) || 0,
              extra_unit_add: Number(extraEach) || 0,
              quantity: newQty,
              pricing: {
                type: 'Group',
                regular_price: Number(regularPrice),
                discount_steps: discountSteps,
              },
              placement_signature: expectedSig,
              placement_coordinates: effectivePlacements,
              product: {
                id: product.id,
                placement_coordinates: effectivePlacements,
                acf: { color: Array.isArray(product?.acf?.color) ? product.acf.color : [] },
              },
              filter_was_changed: filterWasChanged,
              baseline_active_count: baselineActiveCount,
              selected_active_count: selectedActiveCount,
              selected_extra_price_count: extraPricePlaceCount,
              has_extra_selection: hasExtraSelection,
              extra_print_price: Number(product?.extra_print_price) || 0,
              pricing_group_key: hasExtraSelection ? `sig:${placementSignature}` : 'default',
              options: {
                group_type: 'Group',
                color: color.title,
                color_hex_code: color.color_hex_code,
                size,
                color_thumbnail_url: color?.thumbnail?.url || '',
              },
            });
          }
        }
      });
    });

    updates.forEach(({ idx, qty }) => updateItemQuantity(idx, qty));
    additions.forEach(item => addOrUpdateItem(item));
    removals.sort((a, b) => b - a).forEach(idx => removeItem(idx));

    const after = useCartStore.getState().items;
    const remainingOfPid = after
      .map((it, idx) => ({ it, idx }))
      .filter(
        ({ it }) => it?.options?.group_type === 'Group' && String(it?.product_id || '') === pid
      );
    if (remainingOfPid.length > 0) {
      const { it, idx } = remainingOfPid[0];
      updateItemQuantity(idx, it.quantity);
    }

    onCartAddSuccess?.();
    onClose();

    if (mode === 'temp' && filterWasChanged) {
      clearFilter(pid);
    }
  };

  if (!product) return null;

  const leftColumn = (
    <form className="flex items-center flex-col relative allaround--group-form w-full">
      <div
  className={clsx(
    // [PATCH] Updated: allow both scrollbars and keep layout stable
    'overflow-x-auto overflow-y-auto scrollbar-thin allaround-scrollbar rounded-lg bg-white mb-4',
    // (You had these separately; combining is fine)
  )}
  style={{
    width: `100%`,
    maxWidth: `600px`,
    minWidth: '300px',
    maxHeight: '357px', // vertical scroll triggers when content exceeds this
    transition: 'width 0.2s cubic-bezier(.42,0,.58,1)',
    // [PATCH] Added: reserve space for scrollbars to avoid layout shift (supported in modern Chromium/Firefox)
    scrollbarGutter: 'stable both-edges',
  }}
>
  {/* Sticky header stays the same */}
  <div className="w-full bg-white sticky top-0 z-10 sticky-top-size-ttile">
    <div className="flex items-center">
      <div className="w-[110px] min-w-[110px] h-[52px] bg-white px-2 flex items-center"></div>

      {/* [PATCH] Updated: fixed-width 60px columns for sizes */}
      <div className="flex gap-[10px] pl-2">
        {sizes.map((size, cIdx) => (
          <div key={cIdx} className="block py-1.5 w-[60px] min-w-[60px] max-w-[60px]">
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
        <div key={rIdx} className="flex items-center border-b" style={{ borderColor: '#eee' }}>
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

          {/* [PATCH] Updated: fixed-width 60px columns for inputs too */}
          <div className="flex gap-[10px] pl-2">
            {sizes.map((size, cIdx) => (
              <div key={cIdx} className="block py-1.5 w-[60px] min-w-[60px] max-w-[60px]">
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
        <div className="flex items-center">
          <div className="w-full">
            <div className="flex items-start justify-between gap-10">
              {/* LEFT COLUMN */}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-base">Current Price per Unit:</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="alarnd--group-price text-lg font-semibold">
                      <span>
                        <span className="woocommerce-Price-currencySymbol">$</span>
                        <span className="current_price">{unitWithExtra.toFixed(2)}</span>
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex-1">
                  {error ? (
                    <div className="text-red-500 text-sm text-left mb-2">{error}</div>
                  ) : stepInfo.nextStep ? (
                    <div className="text-pink text-sm pt-[10px] text-left mb-2 flex flex-col">
                      <span className='inline'>
                        Add {stepInfo.unitsToNext} more items to lower the price to{' '}
                        <b>${nextStepAmountWithExtra.toFixed(2)}</b> per unit 
                        <span className="line-through current_price inline"> (Currently ${unitWithExtra.toFixed(2)})</span>
                      </span>
                      
                    </div>
                  ) : (
                    flatTotalFromMatrix(quantities) > 0 && (
                      <div className="text-green-600 text-left mb-2">
                        {`Unit price: $${unitWithExtra.toFixed(2)}`}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="flex flex-col min-w-[170px] shrink-0 text-right">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base">Total Units:</p>
                  </div>
                  <div>
                    <p className="alarnd--group-price text-lg font-semibold">
                      {quantities.flat().reduce((s, v) => s + (parseInt(v || 0) || 0), 0)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base">Total:</p>
                  </div>
                  <div>
                    <p className="alarnd--group-price text-lg font-semibold">
                      <span className="alarnd--total-price">
                        <span className="current_total_price text-tertiary text-2xl">
                          <span className="woocommerce-Price-currencySymbol">$</span>
                          {(() => {
                            const qty = quantities
                              .flat()
                              .reduce((s, v) => s + (parseInt(v || 0) || 0), 0);
                            const totalCents = Math.round(qty * Number(unitWithExtra || 0) * 100);
                            return fmt2(totalCents);
                          })()}
                        </span>
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full flex justify-between gap-3 mt-7">
          <button
            type="button"
            class="px-15 cursor-pointer py-3 bg-white rounded-[100px] border border-tertiary text-tertiary text-base font-semibold leading-snug"
            onClick={() => {
              onClose?.();
              setTimeout(() => onOpenQuickView?.(product), 0);
            }}
          >
            Quick View
          </button>

          <button
            type="button"
            disabled={quantities.flat().every(v => (parseInt(v || 0) || 0) === 0)}
            class="px-15 cursor-pointer py-3 bg-tertiary rounded-[100px] shadow-[4px_4px_10px_0px_rgba(13,0,113,0.16)] text-white text-base font-semibold leading-snug"
            onClick={handleAddToCart}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) onClose?.();
      }}
    >
      <DialogContent
        className="rounded-2xl shadow-xl bg-white"
        style={{
          width: 'min(1100px, 100vw)',
          maxWidth: '100vw',
          padding: '20px 30px 30px',
        }}
      >
        <DialogClose asChild>
          <button className="alarnd-close-btn" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </DialogClose>

        {/* Title */}
        <div className="mt-3 mb-1">
          <h2 className="text-xl font-bold text-center">{product.name}</h2>
        </div>

        {/* Active areas count hint, if any */}
        {activePlacementsUI.length > 0 && (
          <div className="mx-auto max-w-full flex flex-wrap justify-center gap-1 mb-4">
            {activePlacementsUI.map(pl => (
              <div
                key={pl.name}
                className="inline-flex flex-row-reverse items-stretch px-0 py-0 rounded-full leading-[10px] text-[10px] font-medium border border-emerald-600 text-emerald-700 bg-emerald-50 overflow-hidden"
                title={pl.name}
              >
                {pl.forceBack && (
                  <div className="bg-black text-white flex items-center justify-center px-1.5">
                    <span className="font-bold">B</span>
                  </div>
                )}
                <div className="px-1.5 py-1">
                  <span className="text-emerald-700 font-medium">{pl.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Other quantity in cart */}
        {otherQtyInCart > 0 && (
          <div className="text-center text-xs text-gray-600 -mt-2 mb-3">
            {otherQtyInCart} more in cart
          </div>
        )}

        {/* Two-column layout: left (form) + right (preview/placements) */}
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="flex-1">{leftColumn}</div>

          <ProductRightColumn
            open={open}
            product={product}
            companyLogos={companyLogos}
            pagePlacementMap={pagePlacementMap}
            customBackAllowedSet={customBackAllowedSet}
            className="lg:max-w-[48%] w-full"
            flexBasis="48%"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function flatTotalFromMatrix(mat) {
  try {
    return mat.flat().reduce((s, v) => s + (parseInt(v || 0) || 0), 0);
  } catch {
    return 0;
  }
}
