'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import NextImage from 'next/image';
import { Trash2, SquarePen } from 'lucide-react';
import { useRemoveItem, useUpdateItemQuantity } from './cartStore';
import { isDarkColor } from '@/utils/color';
import {
  generateCartThumbUrlFromItem,
  generateHoverThumbUrlFromItem,
} from '@/utils/cloudinaryMockup';
import Tooltip from '@/components/ui/Tooltip';

// [PATCH] Added: money helpers for precise line totals
const toCents = v => Math.round(Number(v ?? 0) * 100);
const fmt2 = cents => (Math.max(0, Number(cents || 0)) / 100).toFixed(2);

const SHOW_PLACEMENTS_LABEL = true;
const SHOW_FILTER_CHANGED_LABEL = false;

// ---- Global promise cache so each URL preloads once per session ----
const preloadCache = new Map(); // url -> Promise<string>
const preloadImage = url => {
  if (!url) return Promise.resolve('');
  if (preloadCache.has(url)) return preloadCache.get(url);

  const p = new Promise(resolve => {
    if (typeof window === 'undefined') return resolve(url);
    const img = new window.Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(url); // non-blocking
    img.src = url;
  });
  preloadCache.set(url, p);
  return p;
};

export default function CartItem({
  item,
  idx,
  companyLogos = {},
  pagePlacementMap = {}, // intentionally unused for cart thumbs (cart is frozen)
  customBackAllowedSet = {},
  onOpenEditFromCart,
}) {
  console.log('CartItem', { item, idx, companyLogos, pagePlacementMap });
  const removeItem = useRemoveItem();
  const updateItemQuantity = useUpdateItemQuantity();

  const rowRef = useRef(null);

  const [error, setError] = useState('');
  const [localQuantity, setLocalQuantity] = useState(item.quantity.toString());

  // Images (small for cell, larger for hover preview)
  const [thumbUrl, setThumbUrl] = useState(item.thumbnail || '');
  const [hoverUrl, setHoverUrl] = useState('');
  const [hoverReady, setHoverReady] = useState(false);

  // Hover UI state
  const [hovering, setHovering] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Keep local qty in sync
  useEffect(() => {
    setLocalQuantity(item.quantity.toString());
  }, [item.quantity]);

  // Small cart thumb (<=300) — use the FROZEN snapshot from the item only
  useEffect(() => {
    const url = generateCartThumbUrlFromItem(item, companyLogos, {
      max: 200,
      customBackAllowedSet, // ❌ no pagePlacementMap here — cart is frozen
    });
    setThumbUrl(url || item.thumbnail || '');
  }, [
    item?.product_id,
    item?.options?.color,
    item?.options?.size,
    item?.placement_coordinates, // frozen placements
    item?.filter_was_changed,
    companyLogos,
    customBackAllowedSet,
  ]);

  // Hover (bigger) cart image — also from the frozen snapshot
  useEffect(() => {
    const url = generateHoverThumbUrlFromItem(item, companyLogos, {
      max: 400,
      customBackAllowedSet, // ❌ no pagePlacementMap here — cart is frozen
    });
    setHoverUrl(url || thumbUrl || item.thumbnail || '');
    if (url) preloadImage(url).then(() => setHoverReady(true));
  }, [
    item?.product_id,
    item?.options?.color,
    item?.options?.size,
    item?.placement_coordinates,
    item?.filter_was_changed,
    companyLogos,
    customBackAllowedSet,
    thumbUrl,
  ]);

  // Preload hover image early: when row is near viewport (IO), else on idle
  useEffect(() => {
    if (!hoverUrl) return;
    let cancelled = false;

    const kick = () => {
      preloadImage(hoverUrl).then(() => {
        if (!cancelled) setHoverReady(true);
      });
    };

    if ('IntersectionObserver' in window && rowRef.current) {
      const io = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              kick();
              io.disconnect();
              break;
            }
          }
        },
        { rootMargin: '200px' }
      );
      io.observe(rowRef.current);
      return () => {
        cancelled = true;
        io.disconnect();
      };
    }

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(kick, { timeout: 1200 });
      return () => {
        cancelled = true;
        if ('cancelIdleCallback' in window) window.cancelIdleCallback(id);
      };
    } else {
      const t = setTimeout(kick, 200);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
  }, [hoverUrl]);

  // Safety: ensure URL exists if first hover happens super fast
  const ensureHoverUrl = useCallback(() => {
    if (!hoverUrl) {
      const url = generateHoverThumbUrlFromItem(item, companyLogos, { max: 400 });
      setHoverUrl(url || thumbUrl || item.thumbnail || '');
      if (url) preloadImage(url).then(() => setHoverReady(true));
    }
  }, [hoverUrl, item, companyLogos, thumbUrl]);

  const onThumbEnter = () => {
    ensureHoverUrl();
    setHovering(true);
  };
  const onThumbLeave = () => setHovering(false);

  const onThumbMove = e => {
    const OFFSET = 18;
    const maxW = 400;
    const maxH = 400;
    const pad = 16;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let nx = e.clientX + OFFSET;
    let ny = e.clientY + OFFSET;

    if (nx + maxW + pad > vw) nx = Math.max(8, vw - (maxW + pad + 8));
    if (ny + maxH + pad > vh) ny = Math.max(8, vh - (maxH + pad + 8));

    setPos({ x: nx, y: ny });
  };

  // Quantity helpers
  const minQuantity = 1;
  const maxQuantity = 999;

  const handleQuantityChange = value => {
    let cleanValue = value.replace(/[^0-9]/g, '');
    if (cleanValue.length > 1 && cleanValue[0] === '0') cleanValue = cleanValue.replace(/^0+/, '');
    setLocalQuantity(cleanValue);

    const numValue = parseInt(cleanValue) || 0;
    if (!cleanValue) {
      setError('');
      return;
    }
    if (numValue < minQuantity) {
      setError(`Minimum quantity: ${minQuantity}`);
      return;
    }
    if (numValue > maxQuantity) {
      setError(`Maximum quantity: ${maxQuantity}`);
      setLocalQuantity(maxQuantity.toString());
      updateItemQuantity(idx, maxQuantity);
      return;
    }

    setError('');
    updateItemQuantity(idx, numValue);
  };

  const handleQuantityBlur = () => {
    const numValue = parseInt(localQuantity) || 0;
    if (!localQuantity || numValue < minQuantity) {
      setLocalQuantity(minQuantity.toString());
      updateItemQuantity(idx, minQuantity);
      setError('');
    }
  };

  // [PATCH] Contrast-safe border color for color chip
  const bgHex = item?.options?.color_hex_code || '#ffffff';
  const textColor = isDarkColor(bgHex) ? '#fff' : '#000';

  // Tiny helper to detect “similar” colors (Euclidean RGB distance)
  const colorsAreSimilar = (a, b, threshold = 28) => {
    const norm = hex => {
      const h = String(hex || '').replace('#', '');
      const v =
        h.length === 3
          ? h
              .split('')
              .map(c => c + c)
              .join('')
          : h.padEnd(6, '0');
      return [
        parseInt(v.slice(0, 2), 16),
        parseInt(v.slice(2, 4), 16),
        parseInt(v.slice(4, 6), 16),
      ];
    };
    const [r1, g1, b1] = norm(a);
    const [r2, g2, b2] = norm(b);
    const dist = Math.hypot(r1 - r2, g1 - g2, b1 - b2);
    return dist < threshold; // smaller = more similar
  };

  let borderColor = textColor;
  // [PATCH] If text color and background are same/similar, flip the border to the opposite
  if (colorsAreSimilar(borderColor, bgHex)) {
    borderColor = textColor === '#fff' ? '#000' : '#fff';
  }

  const renderProductDetails = () => {
    // Build active placement labels from the FROZEN snapshot on the item
    // [PATCH] Expanded: include extraPrice and keep forceBack
    const activePlacements = (
      Array.isArray(item?.placement_coordinates) ? item.placement_coordinates : []
    )
      .filter(p => p && p.name && p.active)
      .map(p => ({
        name: String(p.name),
        forceBack: !!p.__forceBack,
        extraPrice: !!p.extraPrice,
      }));

    console.log(`activePlacements for ${item.product_id}:`, item);
    console.log(`activePlacements for ${item.product_id}:`, activePlacements);

    return (
      <div className="space-y-1">
        <div className="font-semibold text-skyblue text-[15px] text-center md:text-left">
          {item.name}
        </div>

        {item.options?.group_type === 'Group' && (
          <div className="space-y-1 text-sm text-gray-600 flex gap-0 md:gap-0 mb-2 md:mb-2 flex-col">
            <div className="flex items-center gap-2 mx-auto md:mx-0">
              <span>Color:</span>
              <span
                className="p-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: bgHex,
                  color: textColor,
                  border: `1px solid ${borderColor}`,
                  padding: '2px 6px',
                }}
              >
                {item.options.color}
              </span>
            </div>
            <div className="mx-auto md:mx-0">
              Size: <span className="font-medium">{item.options.size}</span>
            </div>
          </div>
        )}

        {/* ✅ Placement labels */}
        {/* ✅ Placement labels */}
        {SHOW_PLACEMENTS_LABEL && activePlacements.length > 0 && (
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {activePlacements.map(pl => (
                <div
                  key={pl.name}
                  className="inline-flex flex-row-reverse items-stretch px-0 py-0 rounded-full leading-[10px] text-[10px] font-medium border border-emerald-600 text-emerald-700 bg-emerald-50 overflow-hidden"
                  title={pl.name}
                >
                  {/* Left: Back badge */}
                  {pl.forceBack && (
                    <div className="bg-black text-white flex items-center justify-center px-1.5">
                      <span className="font-bold">B</span>
                    </div>
                  )}

                  {/* Middle: Name */}
                  <div className="px-1.5 py-1">
                    <span className="text-emerald-700 font-medium">{pl.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // [PATCH] Updated: cents-precise line total
  const priceCents = Math.round(Number(item?.price || 0) * 100);
  const qty = parseInt(item?.quantity) || 0;
  const totalCents = priceCents * qty;

  // console.log('item', item);

  return (
    <div
      ref={rowRef}
      className="p-4 border border-gray-200 rounded-lg bg-white items-center flex flex-col gap-3 md:grid md:grid-cols-7 md:gap-4"
    >
      {/* 1) Thumbnail + hover preview */}
      <div
        className="flex justify-center relative"
        onMouseEnter={onThumbEnter}
        onMouseLeave={onThumbLeave}
        onMouseMove={onThumbMove}
      >
        <NextImage
          src={thumbUrl || item.thumbnail || ''}
          alt={item.name}
          width={60}
          height={60}
          className="w-15 h-15 rounded object-cover border border-gray-100"
          unoptimized
        />

        {/* Cursor-following hover tooltip */}
        {hovering && (hoverUrl || thumbUrl) && (
          <div
            className="fixed z-50 pointer-events-none shadow-2xl rounded-lg border border-gray-200 bg-white/90 backdrop-blur"
            style={{
              top: `${pos.y}px`,
              left: `${pos.x}px`,
              maxWidth: 400,
              maxHeight: 400,
              padding: 8,
            }}
          >
            <img
              src={hoverReady ? hoverUrl : hoverUrl || thumbUrl}
              alt={`${item.name} preview`}
              style={{
                display: 'block',
                maxWidth: 384,
                maxHeight: 384,
                objectFit: 'contain',
              }}
            />
          </div>
        )}
      </div>

      {/* 2) Product details */}
      <div className="col-span-2">{renderProductDetails()}</div>

      {/* 3) Unit price */}
      <div className="text-center">
        <div className="text-sm font-semibold text-gray-900">${Number(item.price).toFixed(2)}</div>
        <div className="text-xs text-gray-500">Per unit</div>
        {SHOW_FILTER_CHANGED_LABEL && item.filter_was_changed && (
          <div className="text-xs text-red-500">⚠ Logo placements were changed</div>
        )}

        {/* Extra per-unit chip with tooltip */}
        {Number(item?.extra_unit_add) > 0 && (
          <div className="mt-1">
            <Tooltip
              placement="bottom"
              content={
                <div className="space-y-1">
                  <div className="font-medium">Printing add-on details</div>
                  {(() => {
                    console.log(`item::${item.product_id}`, item);
                    const unit = Number(item?.price) || 0;
                    const base =
                      Number(item?.price_base ?? unit - Number(item?.extra_unit_add || 0)) || 0;
                    const extra = Number(item?.extra_unit_add || 0);

                    // [PATCH] Updated: recompute extras from frozen coordinates as (active - 1), clamped
                    const metaCount = item?.selected_extra_price_count;
                    const recomputedActive = Array.isArray(item?.placement_coordinates)
                      ? item.placement_coordinates.filter(p => p?.active).length
                      : 0;
                    const recomputedCount = Math.max(0, recomputedActive - 1);
                    const extrasN = metaCount != null ? Number(metaCount) : recomputedCount; // prefer stored meta
                    const xPrice = Number(item?.extra_print_price || 0);

                    return (
                      <>
                        <div>
                          <span className="tabular-nums">${base.toFixed(2)}</span> Base
                        </div>
                        <div>
                          + <span className="tabular-nums">${extra.toFixed(2)}</span> Extra
                          {xPrice > 0 &&
                            extrasN > 0 && ( // [PATCH] Updated condition to show only when count > 0
                              <span className="text-gray-500">
                                {' '}
                                ({extrasN}×${xPrice.toFixed(2)})
                              </span>
                            )}
                        </div>
                        <div className="my-1 border-t border-gray-200" />
                        <div>
                          = <span className="font-semibold tabular-nums">${unit.toFixed(2)}</span>{' '}
                          per unit
                        </div>
                      </>
                    );
                  })()}
                </div>
              }
            >
              <span className="inline-flex items-center text-[11px] text-amber-600 px-1.5 py-0.5 rounded border border-amber-200 hover:bg-amber-50 cursor-help select-none">
                +{Number(item.extra_unit_add).toFixed(2)}$
              </span>
            </Tooltip>
          </div>
        )}
      </div>

      {/* 4) Quantity (editable) */}
      <div className="text-center">
        <div className="space-y-1">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={localQuantity}
            onChange={e => handleQuantityChange(e.target.value)}
            onBlur={handleQuantityBlur}
            className={`w-16 px-2 py-1 text-center border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              error ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
            }`}
            maxLength="3"
          />
          {error && <div className="text-sm text-red-500 mt-1">{error}</div>}
        </div>
      </div>

      {/* 5) Total price */}
      <div className="text-center">
        <div className="text-sm font-bold text-gray-900">${fmt2(totalCents)}</div>
        <div className="text-sm text-gray-500">Total</div>
      </div>

      {/* 6) Remove */}
      <div className="text-center">
        <div className="flex gap-1">
          <button
            onClick={() => removeItem(idx)}
            className="p-1 text-red-500 cursor-pointer hover:text-red-700 hover:bg-red-50 transition-colors"
            aria-label="Remove item"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-1 text-blue-600 cursor-pointer hover:text-blue-800 hover:bg-blue-50 transition-colors"
            onClick={() => onOpenEditFromCart?.(item, idx)}
            aria-label="Edit item (placements/quantities)"
            title="Edit item"
          >
            <SquarePen className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
