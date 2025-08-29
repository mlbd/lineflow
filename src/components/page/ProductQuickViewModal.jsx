'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, ChevronDown, X, Check } from 'lucide-react';
import ImageGalleryOverlay from '@/components/page/ImageGalleryOverlay';
import {
  generateProductImageUrl,
  setForceBackOverrides,
  clearForceBackScope,
} from '@/utils/cloudinaryMockup';
import { useAreaFilterStore } from '@/components/cart/areaFilterStore';
import { buildPlacementSignature } from '@/utils/placements';

/* ======= Config (magnifier off by default) ======= */
const DISPLAY_MAX = 640;
const ZOOM_MAX = 2200;
const LENS_DIAMETER = 180;
const LENS_BORDER = '2px solid rgba(0,0,0,0.35)';
const ENABLE_MAGNIFY = false;
const ENABLE_CLICK_TO_POPUP = true;

/* ======= Helpers ======= */
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

// [FORCEBACK] Include side in the signature so Default↔Back triggers a store write
const placementsSig = arr =>
  (Array.isArray(arr) ? arr : [])
    .map(p => {
      const nm = String(p?.name || '')
        .trim()
        .toLowerCase();
      const act = p?.active ? 1 : 0;
      const side = typeof p?.__forceBack === 'boolean' ? (p.__forceBack ? 'B' : 'F') : '_'; // [FORCEBACK]
      return `${nm}:${act}:${side}`;
    })
    .sort()
    .join('|');

function PriceChart({ steps, regularPrice, currency = '₪', extraEach = 0 }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const getRange = i => {
    const thisQty = Number(steps[i]?.quantity);

    // First tier: always from 1 to thisQty
    if (i === 0) {
      return `כמות: 1-${thisQty}`;
    }

    // Middle tiers: from (previousQty + 1) to thisQty
    if (i < steps.length - 1) {
      const prevQty = Number(steps[i - 1]?.quantity);
      return `כמות: ${prevQty + 1}-${thisQty}`;
    }

    // Last tier: thisQty+
    return `כמות: ${thisQty}+`;
  };

  const parseMoney = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const regular = parseMoney(regularPrice);

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold text-center mb-2">תמחור כמות</h2>
      <div className="mt-4 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 border rounded-xl overflow-hidden">
          {steps.map((step, i) => {
            const rowIdx = Math.floor(i / 2);
            const colIdx = i % 2;
            const checkerBg = rowIdx % 2 === colIdx % 2 ? 'bg-bglight' : '';
            const stepAmt = parseMoney(step?.amount);
            const useRegularForFirstTier = i === 0 && stepAmt === 0 && regular > 0;
            const display = (
              (useRegularForFirstTier ? regular : stepAmt) + (Number(extraEach) || 0)
            ).toFixed(2);
            return (
              <div
                key={i}
                className={`flex flex-col items-center border-b last:border-b-0 sm:border-r px-4 py-3 ${checkerBg}`}
              >
                <div className="text-lg font-bold text-primary">
                  {display}
                  {currency}
                </div>
                <div className="text-xs text-gray-500 mt-1">{getRange(i)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ProductQuickViewModal({
  open,
  onClose,
  product,
  onAddToCart,
  bumpPrice, // not used here but kept for compat
  companyLogos = {},
  pagePlacementMap = {},
  customBackAllowedSet = {},
}) {
  /* ===== Slider & image state ===== */
  const [sliderIdx, setSliderIdx] = useState(0);
  const [slideLoading, setSlideLoading] = useState(false);
  const [slideSrc, setSlideSrc] = useState('');
  const [ready, setReady] = useState({});
  const [preloading, setPreloading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const preloadCacheRef = useRef(new Map());

  /* ===== Lens state ===== */
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [lensVisible, setLensVisible] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [zoomReady, setZoomReady] = useState({});

  /* ====== Area filter overrides (local toggles; persisted globally) ====== */
  const [areaOn, setAreaOn] = useState(new Set());
  const [areaOff, setAreaOff] = useState(new Set());

  // Back-mode per placement: 'Default' (front) or 'Back'
  const [backChoice, setBackChoice] = useState(new Map());
  const [openBackFor, setOpenBackFor] = useState('');

  const [backScope, setBackScope] = useState('');

  const acf = product?.acf || {};
  const hasSlider = acf?.group_type === 'Group' && Array.isArray(acf.color) && acf.color.length > 0;
  const colors = useMemo(() => (hasSlider ? acf.color : []), [hasSlider, acf?.color]);

  // Steps for price chart
  const steps = useMemo(() => {
    if (acf?.group_type === 'Group' && Array.isArray(acf.discount_steps)) return acf.discount_steps;
    if (acf?.group_type === 'Quantity' && Array.isArray(acf.quantity_steps))
      return acf.quantity_steps;
    return [];
  }, [acf]);

  /* ====== Base placements: page overrides > product defaults ====== */
  const sourcePlacements = useMemo(() => {
    if (!product) return [];
    const key = String(product.id || '');

    // 1) Page override
    if (
      pagePlacementMap &&
      typeof pagePlacementMap === 'object' &&
      !Array.isArray(pagePlacementMap)
    ) {
      const pageVal = pagePlacementMap[key];
      const pageArr = parseMaybeArray(pageVal);
      if (pageArr.length) return pageArr;
      if (pageVal && typeof pageVal === 'object') {
        if (Array.isArray(pageVal[key])) return pageVal[key];
        if (Array.isArray(pageVal.placements)) return pageVal.placements;
      }
    }

    // 2) Product default
    const prodVal =
      product?.placement_coordinates ??
      product?.meta?.placement_coordinates ??
      product?.acf?.placement_coordinates;

    const direct = parseMaybeArray(prodVal);
    if (direct.length) return direct;
    if (prodVal && typeof prodVal === 'object') {
      if (Array.isArray(prodVal[key])) return prodVal[key];
      if (Array.isArray(prodVal.placements)) return prodVal.placements;
    }
    return [];
  }, [product, pagePlacementMap]);

  /* ====== Global store sync: persist selection across close/reopen ====== */
  const setFilter = useAreaFilterStore(s => s.setFilter);

  // Select only this product's placements to limit re-renders
  const storePlacements = useAreaFilterStore(s =>
    product?.id ? s.filters[String(product.id)] || null : null
  );

  // Base we show in the modal (persisted across close/reopen)
  const basePlacements = useMemo(
    () => (storePlacements && storePlacements.length ? storePlacements : sourcePlacements),
    [storePlacements, sourcePlacements]
  );

  // "Original" map to decide toggle behavior should be taken from the base (not always product default)
  const originalActiveByName = useMemo(() => {
    const map = new Map();
    basePlacements.forEach(p => map.set(p?.name || '', !!p?.active));
    return map;
  }, [basePlacements]);

  // Count actives and compute extra
  const countActive = (arr = []) =>
    Array.isArray(arr) ? arr.filter(p => p && p.active).length : 0;
  const baselineActiveCount = useMemo(() => countActive(sourcePlacements), [sourcePlacements]); // [PATCH] kept (not used for extra math)
  const selectedActiveCount = useMemo(() => countActive(basePlacements), [basePlacements]); // [PATCH] kept (not used for extra math)

  const extraPrint = useMemo(
    () => Math.max(0, Number(product?.extra_print_price) || 0),
    [product?.extra_print_price]
  );

  // [PATCH] Added: count active placements flagged extraPrice=true among CURRENT selection
  const extraPricePlaceCount = useMemo(
    () =>
      Array.isArray(basePlacements)
        ? basePlacements.filter(p => p?.active && p?.extraPrice === true).length
        : 0,
    [basePlacements]
  );

  // [PATCH] Updated formula: ignore baseline entirely
  const extraEach = useMemo(
    () => extraPricePlaceCount * extraPrint,
    [extraPricePlaceCount, extraPrint]
  );

  // Reset local toggles on product/open, but DO NOT clear global store selection
  useEffect(() => {
    if (!product || !open) return;
    setAreaOn(new Set());
    setAreaOff(new Set());
    // initialize backChoice from persisted placements if present
    const init = new Map();
    (basePlacements || []).forEach(p => {
      const nm = p?.name || '';
      if (!nm) return;
      if (typeof p.__forceBack === 'boolean') {
        init.set(nm, p.__forceBack ? 'Back' : 'Default');
      }
    });
    // New scope token per open, isolates this flow from others
    const token = `pqv-${product.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setBackScope(token);
    // setBackChoice(init);
    setOpenBackFor('');
  }, [product?.id, open]);

  useEffect(() => {
    if (!product?.id || !backScope) return;
    setForceBackOverrides(
      product.id,
      // convert Map<'Default'|'Back'> to name->boolean
      Array.from(backChoice.entries()).reduce((acc, [k, v]) => {
        acc[k] = v === 'Back' ? true : false;
        return acc;
      }, {}),
      { scope: backScope }
    );
  }, [product?.id, backChoice, backScope]);

  // Toggle helper
  const toggleArea = name => {
    if (!name) return;
    const wasActive = originalActiveByName.get(name);
    const nextOn = new Set(areaOn);
    const nextOff = new Set(areaOff);

    if (wasActive) {
      if (nextOff.has(name)) nextOff.delete(name);
      else {
        nextOff.add(name);
        nextOn.delete(name);
      }
    } else {
      if (nextOn.has(name)) nextOn.delete(name);
      else {
        nextOn.add(name);
        nextOff.delete(name);
      }
    }
    console.log('toggleArea', { name, wasActive, nextOn, nextOff });
    setAreaOn(nextOn);
    setAreaOff(nextOff);
    // [PATCH] Added: if this placement supports back and will be active AFTER the toggle,
    // and no explicit choice was made yet, set default choice to "Back".
    const targetP = (basePlacements || []).find(pp => (pp?.name || '') === name);
    const canBackHere =
      !!targetP?.back &&
      !!(
        (companyLogos?.back_darker && companyLogos.back_darker.url) ||
        (companyLogos?.back_lighter && companyLogos.back_lighter.url)
      );

    if (canBackHere && !backChoice.has(name)) {
      // compute effectiveActive AFTER this toggle
      const effectiveAfter = wasActive ? !nextOff.has(name) : nextOn.has(name);
      if (effectiveAfter) {
        const nextMap = new Map(backChoice);
        nextMap.set(name, 'Back'); // default to Back
        setBackChoice(nextMap); // [PATCH] ensure setForceBackOverrides sees it immediately
      }
    }
    setSliderIdx(0);
  };

  // Apply local toggles to the base placements (this becomes the effective placements)
  const previewPlacements = useMemo(() => {
    return basePlacements.map(p => {
      const nm = p?.name || '';
      const isAdded = areaOn.has(nm);
      const isRemoved = areaOff.has(nm);
      const effectiveActive = isRemoved ? false : isAdded ? true : !!p?.active;

      // [FORCEBACK] Only set __forceBack when the user chose a side
      // [PATCH] Updated: default to __forceBack: true when canBack && effectiveActive && no explicit choice
      const canBackHere =
        !!p?.back &&
        !!(
          (companyLogos?.back_darker && companyLogos.back_darker.url) ||
          (companyLogos?.back_lighter && companyLogos.back_lighter.url)
        );

      const choice = backChoice.get(nm); // 'Back' | 'Default' | undefined

      let sidePatch = {};
      if (choice === 'Back') {
        sidePatch = { __forceBack: true }; // explicit Back
      } else if (choice === 'Default') {
        sidePatch = { __forceBack: false }; // explicit Default
      } else if (canBackHere && effectiveActive) {
        sidePatch = { __forceBack: true }; // [PATCH] default Back when active and no explicit choice
      }

      return { ...p, active: effectiveActive, ...sidePatch };
    });
  }, [basePlacements, areaOn, areaOff, backChoice]);

  // Detect if changed vs base (not vs product default)
  // Did the user change vs source?
  const filterWasChanged = useMemo(() => {
    return buildPlacementSignature(previewPlacements) !== buildPlacementSignature(sourcePlacements);
  }, [previewPlacements, sourcePlacements]);

  // Product object used for image generators and for Add-to-Cart
  const previewProduct = useMemo(() => {
    if (!product) return null;
    return {
      ...product,
      placement_coordinates: previewPlacements,
      filter_was_changed: filterWasChanged, // ✅ pass the flag
    };
  }, [product, previewPlacements, filterWasChanged]);

  // Prevent infinite loop: only save to store when effective placements actually changed
  const lastSavedSigRef = useRef('');
  useEffect(() => {
    const pid = product?.id;
    if (!pid) return;
    const effSig = placementsSig(previewPlacements);
    const storeSig = placementsSig(storePlacements);

    // If store already matches or we already saved this exact signature, skip
    if (effSig === storeSig || effSig === lastSavedSigRef.current) return;

    setFilter(pid, previewPlacements); // store has its own no-op guard too
    lastSavedSigRef.current = effSig;
  }, [product?.id, previewPlacements, storePlacements, setFilter]);

  // When switching products, reset the saved signature tracker
  useEffect(() => {
    lastSavedSigRef.current = placementsSig(storePlacements);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  /* ====== Image Preloaders ====== */
  const preloadImage = url => {
    if (!url) return Promise.resolve();
    const cache = preloadCacheRef.current;
    if (cache.has(url)) return cache.get(url);
    const p = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return resolve(url);
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error('Image failed: ' + url));
      img.src = url;
    });
    cache.set(url, p);
    return p;
  };

  // Full gallery images (keep high-res)
  const galleryImages = useMemo(() => {
    if (!previewProduct) return [];
    if (hasSlider) {
      return colors.map((c, i) => ({
        src: generateProductImageUrl(previewProduct, companyLogos, {
          colorIndex: i,
          customBackAllowedSet,
          max: 2000,
        }),
        alt: c?.title || previewProduct?.name || `Image ${i + 1}`,
      }));
    }
    return [
      {
        src: generateProductImageUrl(previewProduct, companyLogos, {
          customBackAllowedSet,
          max: 2000,
        }),
        alt: previewProduct?.name || 'Image',
      },
    ];
  }, [previewProduct, hasSlider, colors, companyLogos, customBackAllowedSet]);

  // Display slide URLs
  const modalSlideUrls = useMemo(() => {
    if (!previewProduct) return [];
    if (hasSlider) {
      return colors.map((_, i) =>
        generateProductImageUrl(previewProduct, companyLogos, {
          colorIndex: i,
          max: DISPLAY_MAX,
          customBackAllowedSet,
        })
      );
    }
    return [
      generateProductImageUrl(previewProduct, companyLogos, {
        max: DISPLAY_MAX,
        customBackAllowedSet,
      }),
    ];
  }, [previewProduct, hasSlider, colors, companyLogos, customBackAllowedSet]);

  // Zoom URLs (if magnifier is enabled)
  const zoomSlideUrls = useMemo(() => {
    if (!ENABLE_MAGNIFY || !previewProduct) return [];
    if (hasSlider) {
      return colors.map((_, i) =>
        generateProductImageUrl(previewProduct, companyLogos, {
          colorIndex: i,
          max: ZOOM_MAX,
          customBackAllowedSet,
        })
      );
    }
    return [
      generateProductImageUrl(previewProduct, companyLogos, {
        max: ZOOM_MAX,
        customBackAllowedSet,
      }),
    ];
  }, [previewProduct, hasSlider, colors, companyLogos, customBackAllowedSet]);

  // Reset image states on product change
  useEffect(() => {
    if (!product) return;
    setSliderIdx(0);
    setReady({});
    setZoomReady({});
    setGalleryOpen(false);
    setSlideSrc('');
    setSlideLoading(false);
  }, [product]);

  // Load current display slide
  useEffect(() => {
    if (!open || !product) return;
    if (!modalSlideUrls.length) return;

    const url = modalSlideUrls[hasSlider ? sliderIdx : 0];
    if (!url) return;

    if (ready[hasSlider ? sliderIdx : 0] === url) {
      setSlideSrc(url);
      setSlideLoading(false);
      return;
    }

    setSlideLoading(true);
    let cancelled = false;
    preloadImage(url)
      .then(u => {
        if (cancelled) return;
        setReady(prev => ({ ...prev, [hasSlider ? sliderIdx : 0]: u }));
        setSlideSrc(u);
        setSlideLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSlideLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, sliderIdx, hasSlider, modalSlideUrls, ready, product]);

  // Preload all display slides on open
  useEffect(() => {
    if (!open || !product) return;
    if (!modalSlideUrls.length) return;

    let cancelled = false;
    setPreloading(true);

    Promise.all(modalSlideUrls.map(preloadImage))
      .then(loaded => {
        if (cancelled) return;
        setReady(prev => {
          const next = { ...prev };
          loaded.forEach((u, i) => {
            if (u) next[i] = u;
          });
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setPreloading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, modalSlideUrls, product]);

  // Preload the CURRENT zoom slide
  useEffect(() => {
    if (!ENABLE_MAGNIFY) return;
    if (!open || !product) return;
    if (!zoomSlideUrls.length) return;

    const idx = hasSlider ? sliderIdx : 0;
    const url = zoomSlideUrls[idx];
    if (!url) return;

    let cancelled = false;
    preloadImage(url)
      .then(() => {
        if (cancelled) return;
        setZoomReady(prev => ({ ...prev, [idx]: true }));
      })
      .catch(() => {
        if (!cancelled) setZoomReady(prev => ({ ...prev, [idx]: false }));
      });

    return () => {
      cancelled = true;
    };
  }, [open, sliderIdx, hasSlider, zoomSlideUrls, product]);

  // Measure rendered image size
  const measureImg = () => {
    const el = imgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setImgDims({ w: rect.width, h: rect.height });
  };
  useEffect(() => {
    measureImg();
    const onResize = () => measureImg();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [slideSrc]);

  if (!product) return null;

  const navDisabled = preloading || slideLoading || !open;
  const handleMouseMove = e => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    x = Math.max(0, Math.min(rect.width, x));
    y = Math.max(0, Math.min(rect.height, y));
    setLensPos({ x, y });
  };

  const currentZoomReady = zoomReady[hasSlider ? sliderIdx : 0] === true;
  const currentZoomUrl = ENABLE_MAGNIFY ? zoomSlideUrls[hasSlider ? sliderIdx : 0] || '' : '';

  const handleAddToCartClick = () => {
    if (onClose) onClose();
    if (onAddToCart) onAddToCart(previewProduct);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="!max-w-[900px] p-0 rounded-2xl overflow-hidden shadow-xl">
          <DialogClose asChild>
            <button
              className="absolute top-2 right-2 z-10 bg-white rounded-full cursor-pointer p-2 shadow hover:bg-bglighter focus:outline-none focus:ring-2 focus:ring-skyblue"
              aria-label="סגור"
            >
              <X className="w-5 h-5" />
            </button>
          </DialogClose>

          <div className="flex items-center justify-center w-full pt-8 pb-2">
            <DialogTitle className="text-2xl font-bold text-deepblue mb-2">
              {product?.name}
            </DialogTitle>
          </div>

          <div className="flex flex-row w-full pb-8" style={{ minHeight: 360 }}>
            {/* Left column */}
            <div
              className="flex flex-col justify-start px-[35px] pt-2 pb-8"
              style={{ flexBasis: '38%' }}
            >
              <DialogDescription className="prose prose-sm max-w-none mb-4 text-primary">
                {product?.acf?.pricing_description
                  ? product.acf.pricing_description.replace(/<[^>]+>/g, '')
                  : 'פרטי מוצר'}
              </DialogDescription>

              {/* AREA FILTER */}
              {basePlacements.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-1">מיקומי לוגו</div>
                  <div className="flex flex-wrap gap-2">
                    {basePlacements.map(p => {
                      const nm = p?.name || '';
                      const orig = !!p?.active; // from base (store/page/product)
                      const isAdded = areaOn.has(nm);
                      const isRemoved = areaOff.has(nm);
                      const effectiveActive = isRemoved ? false : isAdded ? true : orig;
                      const canBack =
                        !!p?.back &&
                        !!(
                          (companyLogos?.back_darker && companyLogos.back_darker.url) ||
                          (companyLogos?.back_lighter && companyLogos.back_lighter.url)
                        );
                      const currentChoice = backChoice.get(nm) || 'Back';
                      return (
                        <div key={nm} className="relative inline-flex items-center">
                          <button
                            type="button"
                            onClick={() => toggleArea(nm)}
                            className={`${canBack ? 'pl-[20px] pr-3 py-1' : 'px-3 py-1'} rounded-full border text-xs font-medium transition relative cursor-pointer
                             ${
                               effectiveActive
                                 ? 'bg-emerald-600 text-white border-emerald-600'
                                 : isAdded
                                   ? 'bg-sky-600 text-white border-sky-600'
                                   : isRemoved
                                     ? 'bg-gray-300 text-gray-700 border-gray-300'
                                     : 'bg-white text-primary border-gray-300 hover:bg-gray-50'
                             }`}
                            title={nm}
                          >
                            <span className="mr-1">{nm}</span>
                            {canBack && (
                              <span
                                className="ml-1 inline-flex items-center absolute w-[12px] h-[100%] top-0 left-0"
                                onClick={e => {
                                  e.stopPropagation();
                                  setOpenBackFor(openBackFor === nm ? '' : nm);
                                  if (effectiveActive) toggleArea(nm);
                                }}
                                role="button"
                                aria-label="בחר לוגו גב"
                              >
                                <ChevronDown className="w-3 h-3 opacity-90" />
                              </span>
                            )}
                          </button>

                          {/* Back-mode dropdown */}
                          {canBack && openBackFor === nm && (
                            <div
                              className="absolute z-20 left-0 top-full mt-1 min-w-[140px] rounded-md border bg-white shadow-lg overflow-hidden"
                              onMouseLeave={() => setOpenBackFor('')}
                              role="menu"
                              aria-label={`${nm} logo side`}
                            >
                              {['Default', 'Back'].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  className={`block cursor-pointer w-full text-left px-3 py-1 text-xs hover:bg-gray-50 ${
                                    currentChoice === opt
                                      ? 'text-primary font-semibold'
                                      : 'text-gray-700'
                                  }`}
                                  onClick={() => {
                                    const next = new Map(backChoice);
                                    next.set(nm, opt);
                                    setBackChoice(next);
                                    setOpenBackFor('');
                                    toggleArea(nm);
                                  }}
                                  role="menuitem"
                                >
                                  {currentChoice === opt && (
                                    <Check className="w-[15px] h-[15px] text-emerald-600 inline-block ml-2" />
                                  )}
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <PriceChart
                steps={steps}
                regularPrice={product?.regular_price ?? product?.price}
                extraEach={extraEach}
              />

              <div>
                <button
                  className="alarnd-btn mt-5 bg-primary text-white"
                  onClick={handleAddToCartClick}
                >
                  הוסיפו לעגלה
                </button>
              </div>
            </div>

            {/* Right column */}
            <div
              className="flex flex-col justify-center items-center relative"
              style={{ flexBasis: '62%' }}
            >
              <div
                ref={containerRef}
                className="flex items-center justify-center w-full relative"
                style={{ height: 310 }}
                onMouseEnter={ENABLE_MAGNIFY ? () => setLensVisible(true) : undefined}
                onMouseLeave={ENABLE_MAGNIFY ? () => setLensVisible(false) : undefined}
                onMouseMove={ENABLE_MAGNIFY ? handleMouseMove : undefined}
              >
                {slideSrc ? (
                  <img
                    ref={imgRef}
                    src={slideSrc}
                    alt={hasSlider ? acf.color[sliderIdx]?.title || product.name : product.name}
                    className={`max-h-[300px] max-w-full object-contain rounded-xl shadow transition-opacity duration-200 ${
                      slideLoading ? 'opacity-70' : 'opacity-100'
                    } ${ENABLE_CLICK_TO_POPUP ? 'cursor-zoom-in' : 'cursor-default'}`}
                    loading="eager"
                    onClick={ENABLE_CLICK_TO_POPUP ? () => setGalleryOpen(true) : undefined}
                    onLoad={measureImg}
                    draggable={false}
                  />
                ) : (
                  <div className="h-[300px] w-full max-w-[520px] rounded-xl bg-gray-100 animate-pulse" />
                )}

                {(slideLoading || preloading) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                  </div>
                )}

                {ENABLE_MAGNIFY &&
                  lensVisible &&
                  currentZoomReady &&
                  currentZoomUrl &&
                  imgDims.w > 0 &&
                  imgDims.h > 0 && (
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: `${lensPos.x - LENS_DIAMETER / 2}px`,
                        top: `${lensPos.y - LENS_DIAMETER / 2}px`,
                        width: `${LENS_DIAMETER}px`,
                        height: `${LENS_DIAMETER}px`,
                        border: LENS_BORDER,
                        borderRadius: '50%',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        pointerEvents: 'none',
                        backgroundImage: `url("${currentZoomUrl}")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: `${imgDims.w * (ZOOM_MAX / DISPLAY_MAX)}px ${imgDims.h * (ZOOM_MAX / DISPLAY_MAX)}px`,
                        backgroundPosition: `-${lensPos.x * (ZOOM_MAX / DISPLAY_MAX) - LENS_DIAMETER / 2}px -${lensPos.y * (ZOOM_MAX / DISPLAY_MAX) - LENS_DIAMETER / 2}px`,
                        zIndex: 5,
                      }}
                    />
                  )}
              </div>

              {/* Prev/Next */}
              {hasSlider && colors.length > 1 && (
                <>
                  <button
                    className="absolute top-1/2 mt-[-11px] left-2 -translate-y-1/2 bg-white rounded-full p-2 shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setSliderIdx((sliderIdx - 1 + colors.length) % colors.length)}
                    aria-label="הקודם"
                    disabled={navDisabled}
                    type="button"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    className="absolute top-1/2 mt-[-11px] right-2 -translate-y-1/2 bg-white rounded-full p-2 shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setSliderIdx((sliderIdx + 1) % colors.length)}
                    aria-label="הבא"
                    disabled={navDisabled}
                    type="button"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Color dots */}
              {hasSlider && (
                <div className="flex justify-center mt-4 gap-2">
                  {colors.map((clr, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSliderIdx(idx)}
                      disabled={navDisabled && idx !== sliderIdx}
                      className={`w-[20px] h-[20px] rounded-[7px] border-2 shadow-[0_0_0_2px_white,0_0_0_3px_#cccccc] transition-all duration-150
                        ${sliderIdx === idx ? 'ring-2 ring-skyblue' : ''} ${navDisabled ? 'opacity-60' : ''}`}
                      style={{
                        background: clr.color_hex_code,
                        cursor: navDisabled ? 'not-allowed' : 'pointer',
                      }}
                      title={clr.title}
                      aria-label={clr.title}
                      type="button"
                    />
                  ))}
                </div>
              )}

              {preloading && hasSlider && colors.length > 1 && (
                <div className="mt-3 text-xs text-gray-500">טוען תמונות מקדימות…</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen gallery overlay */}
      <ImageGalleryOverlay
        open={galleryOpen}
        initialIndex={hasSlider ? sliderIdx : 0}
        images={galleryImages}
        onClose={() => setGalleryOpen(false)}
      />
    </>
  );
}
