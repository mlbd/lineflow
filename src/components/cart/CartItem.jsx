'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import NextImage from 'next/image';
import { Trash2 } from 'lucide-react';
import { useRemoveItem } from './cartStore';
import { isDarkColor } from '@/utils/color';
import {
  generateCartThumbUrlFromItem,
  generateHoverThumbUrlFromItem,
} from '@/utils/cloudinaryMockup';

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
  onOpenQuickViewFromCart, // ⬅️ new
}) {
  const removeItem = useRemoveItem();
  const rowRef = useRef(null);

  const [thumbUrl, setThumbUrl] = useState(item.thumbnail || '');
  const [hoverUrl, setHoverUrl] = useState('');
  const [hoverReady, setHoverReady] = useState(false);

  // Hover UI state
  const [hovering, setHovering] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

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
      customBackAllowedSet,
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

  const renderProductDetails = () => {
    const activePlacements = (
      Array.isArray(item?.placement_coordinates) ? item.placement_coordinates : []
    )
      .filter(p => p && p.name && p.active)
      .map(p => String(p.name));

    return (
      <div className="space-y-1">
        <div className="font-semibold text-skyblue text-[15px]">{item.name}</div>
        <div className="space-y-1 text-sm text-gray-600">
          {item.options?.group_type === 'Group' && (
            <>
              <div className="flex items-center gap-2">
                <span>צבע:</span>
                <span
                  className="p-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: item.options.color_hex_code,
                    color: isDarkColor(item.options.color_hex_code) ? '#fff' : '#000',
                    border: `1px solid ${isDarkColor(item.options.color_hex_code) ? '#fff' : '#000'}`,
                    padding: '2px 6px',
                  }}
                >
                  {item.options.color}
                </span>
              </div>
              <div>
                מידה: <span className="font-medium">{item.options.size}</span>
              </div>
            </>
          )}

          {/* ✅ Placement labels */}
          {SHOW_PLACEMENTS_LABEL && activePlacements.length > 0 && (
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex gap-1 flex-wrap">
                {activePlacements.map(nm => (
                  <span
                    key={nm}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium border border-emerald-600 text-emerald-700 bg-emerald-50"
                    title={nm}
                  >
                    {nm}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const totalPrice = Math.round(item.price * item.quantity * 100) / 100;

  return (
    <div
      ref={rowRef}
      className="grid grid-cols-7 gap-4 p-4 border border-gray-200 rounded-lg bg-white items-center"
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
        <div className="text-sm font-semibold text-gray-900">{item.price} ₪</div>
        <div className="text-xs text-gray-500">ליחידה</div>
        {SHOW_FILTER_CHANGED_LABEL && item.filter_was_changed && (
          <div className="text-xs text-red-500">⚠ מיקומי לוגו שונו</div>
        )}
      </div>

      {/* 4) Quantity — now a button that opens Quick View */}
      <div className="text-center">
        <button
          type="button"
          className="w-16 px-2 cursor-pointer py-1 text-center border rounded bg-gray-50 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
          onClick={() => onOpenQuickViewFromCart?.(item, idx)}
          aria-label="עריכת מיקומי לוגו דרך תצוגה מהירה"
          title="פתח תצוגה מהירה (לעריכת מיקומי לוגו)"
        >
          {item.quantity}
        </button>
      </div>

      {/* 5) Total price */}
      <div className="text-center">
        <div className="text-sm font-bold text-gray-900">{totalPrice} ₪</div>
        <div className="text-sm text-gray-500">סה&quot;כ</div>
      </div>

      {/* 6) Remove */}
      <div className="text-center">
        <button
          onClick={() => removeItem(idx)}
          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
          aria-label="הסר פריט"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
