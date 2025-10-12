// !fullupdate
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ImageGalleryOverlay from '@/components/page/ImageGalleryOverlay';
import { useAreaFilterStore } from '@/components/cart/areaFilterStore';
import { buildPlacementSignature } from '@/utils/placements';
import { generateProductImageUrl, setForceBackOverrides } from '@/utils/cloudinaryMockup';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

/* ======= Config (same as original) ======= */
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

// Signature includes side so Default↔Back differences persist in store
const placementsSig = arr =>
  (Array.isArray(arr) ? arr : [])
    .map(p => {
      const nm = String(p?.name || '')
        .trim()
        .toLowerCase();
      const act = p?.active ? 1 : 0;
      const side = typeof p?.__forceBack === 'boolean' ? (p.__forceBack ? 'B' : 'F') : '_';
      return `${nm}:${act}:${side}`;
    })
    .sort()
    .join('|');

export default function ProductRightColumn({
  open,
  product,
  companyLogos = {},
  pagePlacementMap = {},
  customBackAllowedSet = {},
  onPlacementsChange, // (previewPlacements, filterWasChanged) => void
  onPreviewProduct, // (previewProduct) => void (optional)
  className = '',
  style = {},
  flexBasis = '52%', // default column width
}) {
  const [sliderIdx, setSliderIdx] = useState(0);
  const [slideLoading, setSlideLoading] = useState(false);
  const [slideSrc, setSlideSrc] = useState('');
  const [ready, setReady] = useState({});
  const [preloading, setPreloading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const preloadCacheRef = useRef(new Map());

  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [lensVisible, setLensVisible] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [zoomReady, setZoomReady] = useState({});

  // Area filter local state
  const [areaOn, setAreaOn] = useState(new Set());
  const [areaOff, setAreaOff] = useState(new Set());
  const [backChoice, setBackChoice] = useState(new Map());
  const [openBackFor, setOpenBackFor] = useState('');
  const [backScope, setBackScope] = useState('');

  const acf = product?.acf || {};
  const hasSlider = acf?.group_type === 'Group' && Array.isArray(acf.color) && acf.color.length > 0;
  const colors = useMemo(() => (hasSlider ? acf.color : []), [hasSlider, acf?.color]);

  /* ====== Source placements: page overrides > product defaults ====== */
  const sourcePlacements = useMemo(() => {
    if (!product) return [];
    const key = String(product.id || '');

    // Page override
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

    // Product default
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

  const setFilter = useAreaFilterStore(s => s.setFilter);
  const storePlacements = useAreaFilterStore(s =>
    product?.id ? s.filters[String(product.id)] || null : null
  );

  // Base used for preview: store (if any) else source
  const basePlacements = useMemo(
    () => (storePlacements && storePlacements.length ? storePlacements : sourcePlacements),
    [storePlacements, sourcePlacements]
  );

  const originalActiveByName = useMemo(() => {
    const map = new Map();
    basePlacements.forEach(p => map.set(p?.name || '', !!p?.active));
    return map;
  }, [basePlacements]);

  // extra price calculation helpers
  const countActive = (arr = []) =>
    Array.isArray(arr) ? arr.filter(p => p && p.active).length : 0;

  const extraPrint = useMemo(
    () => Math.max(0, Number(product?.extra_print_price) || 0),
    [product?.extra_print_price]
  );

  // Reset state on product/open
  useEffect(() => {
    if (!product || !open) return;
    setAreaOn(new Set());
    setAreaOff(new Set());
    setOpenBackFor('');
    const token = `prc-${product.id}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    setBackScope(token);
  }, [product?.id, open]);

  // Persist __forceBack overrides globally per product and scope
  useEffect(() => {
    if (!product?.id || !backScope) return;
    setForceBackOverrides(
      product.id,
      Array.from(backChoice.entries()).reduce((acc, [k, v]) => {
        acc[k] = v === 'Back' ? true : false;
        return acc;
      }, {}),
      { scope: backScope }
    );
  }, [product?.id, backChoice, backScope]);

  // Toggle area selection, maintaining previous logic
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

    setAreaOn(nextOn);
    setAreaOff(nextOff);

    // Default to Back if placement supports back & is active after toggle and no explicit choice
    const targetP = (basePlacements || []).find(pp => (pp?.name || '') === name);
    const canBackHere =
      !!targetP?.back &&
      !!(
        (companyLogos?.back_darker && companyLogos.back_darker.url) ||
        (companyLogos?.back_lighter && companyLogos.back_lighter.url)
      );

    const effectiveAfter = wasActive ? !nextOff.has(name) : nextOn.has(name);
    if (canBackHere && !backChoice.has(name) && effectiveAfter) {
      const next = new Map(backChoice);
      next.set(name, 'Back');
      setBackChoice(next);
    }

    setSliderIdx(0);
  };

  // Apply local toggles to base -> previewPlacements
  const previewPlacements = useMemo(() => {
    return basePlacements.map(p => {
      const nm = p?.name || '';
      const isAdded = areaOn.has(nm);
      const isRemoved = areaOff.has(nm);
      const effectiveActive = isRemoved ? false : isAdded ? true : !!p?.active;

      const canBackHere =
        !!p?.back &&
        !!(
          (companyLogos?.back_darker && companyLogos.back_darker.url) ||
          (companyLogos?.back_lighter && companyLogos.back_lighter.url)
        );

      const choice = backChoice.get(nm); // 'Back' | 'Default' | undefined
      let sidePatch = {};
      if (choice === 'Back') sidePatch = { __forceBack: true };
      else if (choice === 'Default') sidePatch = { __forceBack: false };
      else if (canBackHere && effectiveActive) sidePatch = { __forceBack: true };

      return { ...p, active: effectiveActive, ...sidePatch };
    });
  }, [basePlacements, areaOn, areaOff, backChoice, companyLogos]);

  const filterWasChanged = useMemo(
    () => buildPlacementSignature(previewPlacements) !== buildPlacementSignature(sourcePlacements),
    [previewPlacements, sourcePlacements]
  );

  // Notify parent about placements & preview product
  useEffect(() => {
    const pid = product?.id;
    if (!pid) return;
    const effSig = placementsSig(previewPlacements);
    const storeSig = placementsSig(storePlacements);
    if (effSig !== storeSig) {
      setFilter(pid, previewPlacements);
    }
    onPlacementsChange?.(previewPlacements, filterWasChanged);

    if (onPreviewProduct) {
      onPreviewProduct({
        ...product,
        placement_coordinates: previewPlacements,
        filter_was_changed: filterWasChanged,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, previewPlacements, filterWasChanged]);

  // ===== Images (preload / slide) =====
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

  const previewProduct = useMemo(() => {
    if (!product) return null;
    return {
      ...product,
      placement_coordinates: previewPlacements,
      filter_was_changed: filterWasChanged,
    };
  }, [product, previewPlacements, filterWasChanged]);

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

  // UI
  return (
    <div
      className={`flex flex-col justify-center items-center relative px-10 ${className}`}
      style={{ flexBasis: flexBasis, ...style }}
    >
      {/* AREA FILTER */}
      {basePlacements.length > 0 && (
        <div className="mb-4 w-full flex flex-col justify-items-start">
          <div className="text-lg font-bold text-gray-900 mb-5">Logo Placements</div>
          <div className="flex flex-wrap gap-4">
            {basePlacements.map(p => {
              const nm = p?.name || '';
              const orig = !!p?.active;
              const isAdded = areaOn.has(nm);
              const isRemoved = areaOff.has(nm);
              const effectiveActive = isRemoved ? false : isAdded ? true : orig;
              const canBack =
                !!p?.back &&
                !!(
                  (companyLogos?.back_darker && companyLogos.back_darker.url) ||
                  (companyLogos?.back_lighter && companyLogos.back_lighter.url)
                );

              return (
                <div key={nm} className="relative inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleArea(nm)}
                    className={`inline-flex items-stretch rounded-full border text-[14px] leading-[14px] font-medium capitalize transition relative cursor-pointer overflow-hidden
                      ${
                        effectiveActive
                          ? 'bg-primary-100 text-primary-500 ring-2 ring-primatext-primary-500 border border-white shadow-[0_6px_16px_rgba(18,10,122,0.15)]'
                          : isAdded
                            ? 'bg-primary-100 text-primary-500 ring-2 ring-primatext-primary-500 border border-white shadow-[0_6px_16px_rgba(18,10,122,0.15)]'
                            : isRemoved
                              ? 'bg-gray-100 text-gray-500 border border-gray-100 hover:bg-gray-200 hover:border-gray-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-100 hover:bg-gray-200 hover:border-gray-200'
                      }`}
                    title={nm}
                    aria-label={nm}
                    role="button"
                  >
                    {/* Left: Chevron (dropdown trigger). "B" badge if Back in effect */}
                    {canBack &&
                      (() => {
                        const hasExplicit = backChoice.has(nm);
                        const isBack = hasExplicit
                          ? backChoice.get(nm) === 'Back'
                          : effectiveActive;
                        return (
                          <span
                            className={`inline-flex items-center justify-center px-2 gap-1 ${
                              isBack ? 'bg-black text-white' : ''
                            }`}
                            onClick={e => {
                              e.stopPropagation();
                              setOpenBackFor(openBackFor === nm ? '' : nm);
                              if (effectiveActive) toggleArea(nm);
                            }}
                            role="button"
                            aria-label="Select Back Logo"
                          >
                            <ChevronDown className="w-3 h-3" />
                            {isBack && <span className="font-bold leading-none">B</span>}
                          </span>
                        );
                      })()}

                    {/* Middle: Name */}
                    <span className="px-2 py-1">
                      <span className="font-medium">{nm}</span>
                    </span>
                  </button>

                  {/* Back-mode dropdown */}
                  {canBack && openBackFor === nm && (
                    <div
                      className="absolute z-20 left-0 top-full mt-1 min-w-[140px] rounded-md border bg-white overflow-hidden"
                      onMouseLeave={() => setOpenBackFor('')}
                      role="menu"
                      aria-label={`${nm} logo side`}
                    >
                      {['Default', 'Back'].map(opt => {
                        const currentChoice = backChoice.get(nm) || 'Back';
                        return (
                          <button
                            key={opt}
                            type="button"
                            className={`block cursor-pointer w-full text-left px-3 py-1 text-xs hover:bg-gray-50 ${
                              currentChoice === opt ? 'text-primary font-semibold' : 'text-gray-700'
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
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Image display */}
      <div
        ref={containerRef}
        className="flex items-center justify-center w-full mb-6 relative"
        style={{ height: 320 }}
        onMouseEnter={ENABLE_MAGNIFY ? () => setLensVisible(true) : undefined}
        onMouseLeave={ENABLE_MAGNIFY ? () => setLensVisible(false) : undefined}
        onMouseMove={ENABLE_MAGNIFY ? handleMouseMove : undefined}
      >
        {slideSrc ? (
          <img
            ref={imgRef}
            src={slideSrc}
            alt={hasSlider ? acf.color[sliderIdx]?.title || product.name : product.name}
            className={`max-h-[400px] max-w-full object-contain rounded-2xl shadow transition-opacity duration-200 ${
              slideLoading ? 'opacity-70' : 'opacity-100'
            } ${ENABLE_CLICK_TO_POPUP ? 'cursor-zoom-in' : 'cursor-default'}`}
            loading="eager"
            onClick={ENABLE_CLICK_TO_POPUP ? () => setGalleryOpen(true) : undefined}
            onLoad={measureImg}
            draggable={false}
          />
        ) : (
          <div className="h-[400px] w-full max-w-[520px] rounded-xl bg-gray-100 animate-pulse" />
        )}

        {(slideLoading || preloading) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
          </div>
        )}

        {ENABLE_MAGNIFY &&
          lensVisible &&
          (hasSlider ? zoomReady[sliderIdx] === true : zoomReady[0] === true) &&
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
                backgroundImage: `url("${hasSlider ? zoomSlideUrls[sliderIdx] || '' : zoomSlideUrls[0] || ''}")`,
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
            className="cursor-pointer absolute bottom-0 left-10 translate-y-[6px] flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#120A7A] text-white shadow-[0_16px_40px_rgba(18,10,122,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setSliderIdx((sliderIdx - 1 + colors.length) % colors.length)}
            aria-label="Previous"
            disabled={navDisabled}
            type="button"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            className="cursor-pointer absolute bottom-0 right-10 translate-y-[6px] flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#120A7A] text-white shadow-[0_16px_40px_rgba(18,10,122,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setSliderIdx((sliderIdx + 1) % colors.length)}
            aria-label="Next"
            disabled={navDisabled}
            type="button"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Color dots */}
      {hasSlider && (
        <div className="slider-dots relative">
          <div className="mt-4 -top-[5px] relative flex justify-center gap-3">
            {colors.map((clr, idx) => {
              const isSelected = sliderIdx === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setSliderIdx(idx)}
                  disabled={navDisabled && idx !== sliderIdx}
                  className={[
                    'relative h-9 w-9 rounded-[3px] transition-all duration-150',
                    'border-2 border-white outline outline-2 outline-[#C9CDD6]',
                    isSelected
                      ? 'ring-3 ring-primary-500 shadow-[0_4px_12px_rgba(0,0,0,0.10)]'
                      : 'shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
                    navDisabled && idx !== sliderIdx
                      ? 'opacity-60 cursor-not-allowed'
                      : 'cursor-pointer',
                    isSelected
                      ? "before:content-[''] before:absolute before:inset-0 before:m-auto before:h-4 before:w-4 before:rounded-full before:bg-primary-500 before:ring-2 before:ring-white " +
                        "after:content-[''] after:absolute after:inset-0 after:m-auto after:h-[9px] after:w-[5px] after:rotate-45 after:border-b-2 after:border-r-2 after:border-white after:bottom-0.5"
                      : '',
                  ].join(' ')}
                  style={{ background: clr?.color_hex_code || '#D9DDE6' }}
                  title={clr.title}
                  aria-label={clr.title}
                  type="button"
                />
              );
            })}
          </div>
        </div>
      )}

      {preloading && hasSlider && colors.length > 1 && (
        <div className="mt-3 text-xs text-gray-500">Loading previews…</div>
      )}

      {/* Fullscreen gallery overlay */}
      <ImageGalleryOverlay
        open={galleryOpen}
        initialIndex={hasSlider ? sliderIdx : 0}
        images={galleryImages}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  );
}
