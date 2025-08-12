'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import ImageGalleryOverlay from '@/components/page/ImageGalleryOverlay';
import { generateProductImageUrl } from '@/utils/cloudinaryMockup';

function PriceChart({ steps }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const getRange = i => {
    const thisQty = Number(steps[i]?.quantity);
    const nextQty = steps[i + 1] ? Number(steps[i + 1].quantity) : null;
    if (i === 0 && nextQty !== null) {
      return `כמות: 1-${nextQty - 1}`;
    }
    if (i < steps.length - 1 && nextQty !== null) {
      return `כמות: ${thisQty}-${nextQty - 1}`;
    }
    return `כמות: ${thisQty}+`;
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold text-center mb-2">תמחור כמות</h2>
      <div className="mt-4 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 border rounded-xl overflow-hidden">
          {steps.map((step, i) => {
            const rowIdx = Math.floor(i / 2);
            const colIdx = i % 2;
            const checkerBg = rowIdx % 2 === colIdx % 2 ? 'bg-bglight' : '';

            return (
              <div
                key={i}
                className={`flex flex-col items-center border-b last:border-b-0 sm:border-r px-4 py-3 ${checkerBg}`}
              >
                <div className="text-lg font-bold text-primary">
                  {Number(step.amount).toFixed(2)}₪
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
  bumpPrice,
  companyLogos = {},
  pagePlacementMap = {},
  customBackAllowedSet = {},
}) {
  // ALL hooks must be called unconditionally on every render
  const [sliderIdx, setSliderIdx] = useState(0);
  const [slideLoading, setSlideLoading] = useState(false);
  const [slideSrc, setSlideSrc] = useState('');
  const [ready, setReady] = useState({});
  const [preloading, setPreloading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const preloadCacheRef = useRef(new Map());

  // Get product data (or defaults if product is null)
  const acf = product?.acf || {};

  // Steps (unchanged logic—adapt if you use a different source)
  let steps = [];
  if (acf.group_type === 'Group' && Array.isArray(acf.discount_steps)) {
    steps = acf.discount_steps;
  } else if (acf.group_type === 'Quantity' && Array.isArray(acf.quantity_steps)) {
    steps = acf.quantity_steps;
  }

  // Slider presence
  const hasSlider = acf.group_type === 'Group' && Array.isArray(acf.color) && acf.color.length > 0;
  const colors = useMemo(() => (hasSlider ? acf.color : []), [hasSlider, acf.color]);

  // In-memory promise cache for preloads
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

  // Build FULL-SIZE gallery URLs (no max)
  const galleryImages = useMemo(() => {
    if (!product) return [];
    if (hasSlider) {
      return colors.map((c, i) => ({
        src: generateProductImageUrl(product, companyLogos, {
         colorIndex: i,
         pagePlacementMap,
         customBackAllowedSet,
         max: 2000
       }),
        alt: c?.title || product?.name || `Image ${i + 1}`,
      }));
    }
    return [
      {
        src: generateProductImageUrl(product, companyLogos, {
         pagePlacementMap,
         customBackAllowedSet,
         max: 2000
       }),
        alt: product?.name || 'Image',
      },
    ];
  }, [product, hasSlider, colors, companyLogos]);

  // Build **modal** slide URLs (900px fast preview inside quick view)
  const modalSlideUrls = useMemo(() => {
    if (!product) return [];
    if (hasSlider) {
      return colors.map((_, i) =>
        generateProductImageUrl(product, companyLogos, {
         colorIndex: i,
         max: 500,
         pagePlacementMap,
         customBackAllowedSet,
       })
      );
    }
    return [generateProductImageUrl(product, companyLogos, {
     max: 500,
     pagePlacementMap,
     customBackAllowedSet,
   })];
  }, [product, hasSlider, colors, companyLogos, pagePlacementMap, customBackAllowedSet]);

  // Reset when product changes or modal re-opens
  useEffect(() => {
    if (!product) return; // Guard clause but still call the hook
    setSliderIdx(0);
    setReady({});
    setGalleryOpen(false);
    setSlideSrc('');
    setSlideLoading(false);
  }, [product]);

  // Load the **currently displayed** slide image (uses preloaded URL if available)
  useEffect(() => {
    if (!open || !product) return;
    if (!modalSlideUrls.length) return;

    const url = modalSlideUrls[hasSlider ? sliderIdx : 0];
    if (!url) return;

    // If preloaded already, swap instantly
    if (ready[hasSlider ? sliderIdx : 0] === url) {
      setSlideSrc(url);
      setSlideLoading(false);
      return;
    }

    // Otherwise, load it (spinner shown)
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

  // NEW: Preload **all** modal slides on open and keep nav/dots disabled until done
  useEffect(() => {
    if (!open || !product) return;
    if (!modalSlideUrls.length) return;

    let cancelled = false;
    setPreloading(true);

    Promise.all(modalSlideUrls.map(preloadImage))
      .then(loaded => {
        if (cancelled) return;
        // Mark all as ready
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

  // Return null AFTER all hooks have been called
  if (!product) return null;

  // Nav handlers
  const handleDotClick = idx => {
    if (idx === sliderIdx) return;
    setSliderIdx(idx);
  };
  const handlePrev = () => setSliderIdx((sliderIdx - 1 + colors.length) % colors.length);
  const handleNext = () => setSliderIdx((sliderIdx + 1) % colors.length);

  // Disable nav/dots while either: global preload, current slide loading, or closed
  const navDisabled = preloading || slideLoading || !open;

  return (
    <>
      {/* QuickView Modal stays as-is */}
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
              <PriceChart steps={steps} />
              <div>
                <button
                  className="alarnd-btn mt-5 bg-primary text-white"
                  onClick={() => {
                    if (onClose) onClose(); // Close product quick view modal
                    if (onAddToCart) onAddToCart(); // Open add to cart modal
                  }}
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
                className="flex items-center justify-center w-full relative"
                style={{ height: 310 }}
              >
                {/* Click image to open FULL gallery (QuickView stays open) */}
                {slideSrc ? (
                  <img
                    src={slideSrc}
                    alt={hasSlider ? acf.color[sliderIdx]?.title || product.name : product.name}
                    className={`max-h-[300px] max-w-full object-contain rounded-xl shadow transition-opacity duration-200 ${
                      slideLoading ? 'opacity-70' : 'opacity-100'
                    } cursor-zoom-in`}
                    loading="eager"
                    onClick={() => setGalleryOpen(true)}
                    draggable={false}
                  />
                ) : (
                  // Placeholder skeleton while the very first image is being resolved
                  <div className="h-[300px] w-full max-w-[520px] rounded-xl bg-gray-100 animate-pulse" />
                )}

                {/* Spinners */}
                {(slideLoading || preloading) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                  </div>
                )}
              </div>

              {/* Prev/Next (disabled until ALL preloads complete) */}
              {hasSlider && colors.length > 1 && (
                <>
                  <button
                    className="absolute top-1/2 mt-[-11px] left-2 -translate-y-1/2 bg-white rounded-full p-2 shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handlePrev}
                    aria-label="הקודם"
                    disabled={navDisabled}
                    type="button"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    className="absolute top-1/2 mt-[-11px] right-2 -translate-y-1/2 bg-white rounded-full p-2 shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleNext}
                    aria-label="הבא"
                    disabled={navDisabled}
                    type="button"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Color dots (disabled until ALL preloads complete) */}
              {hasSlider && (
                <div className="flex justify-center mt-4 gap-2">
                  {colors.map((clr, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleDotClick(idx)}
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

              {/* Small helper note (optional) */}
              {preloading && hasSlider && colors.length > 1 && (
                <div className="mt-3 text-xs text-gray-500">טוען תמונות מקדימות…</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen gallery overlay (keeps QuickView open underneath) */}
      <ImageGalleryOverlay
        open={galleryOpen}
        initialIndex={hasSlider ? sliderIdx : 0}
        images={galleryImages}
        onClose={() => setGalleryOpen(false)}
      />
    </>
  );
}
