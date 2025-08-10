'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import NextImage from 'next/image'; // ✅ alias the Next component
import { Trash2 } from 'lucide-react';
import { useRemoveItem, useUpdateItemQuantity } from './cartStore';
import { isDarkColor } from '@/utils/color';
import {
  generateCartThumbUrlFromItem,
  generateHoverThumbUrlFromItem,
} from '@/utils/cloudinaryMockup';

// ---- Global promise cache so each URL preloads once per session ----
const preloadCache = new Map(); // url -> Promise<string>
const preloadImage = (url) => {
  if (!url) return Promise.resolve('');
  if (preloadCache.has(url)) return preloadCache.get(url);

  const p = new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(url);
    const img = new window.Image(); // ✅ native constructor
    img.onload = () => resolve(url);
    img.onerror = () => resolve(url); // non-blocking
    img.src = url;
  });
  preloadCache.set(url, p);
  return p;
};

export default function CartItem({ item, idx, companyLogos = {} }) {
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

  // Small cart thumb (<=300)
  useEffect(() => {
    const url = generateCartThumbUrlFromItem(item, companyLogos, { max: 300 });
    setThumbUrl(url || item.thumbnail || '');
  }, [item, companyLogos]);

  // Build larger hover preview (<=400)
  useEffect(() => {
    const big = generateHoverThumbUrlFromItem(item, companyLogos, { max: 400 });
    setHoverUrl(big || '');
    setHoverReady(false);
  }, [item, companyLogos]);

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
        (entries) => {
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

  const onThumbMove = (e) => {
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

  const handleQuantityChange = (value) => {
    let cleanValue = value.replace(/[^0-9]/g, '');
    if (cleanValue.length > 1 && cleanValue[0] === '0') cleanValue = cleanValue.replace(/^0+/, '');
    setLocalQuantity(cleanValue);

    const numValue = parseInt(cleanValue) || 0;
    if (!cleanValue) { setError(''); return; }
    if (numValue < minQuantity) { setError(`כמות מינימלית: ${minQuantity}`); return; }
    if (numValue > maxQuantity) {
      setError(`כמות מקסימלית: ${maxQuantity}`);
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

  const renderProductDetails = () => (
    <div className="space-y-1">
      <div className="font-semibold text-skyblue text-[15px]">{item.name}</div>

      {item.options?.group_type === 'Group' && (
        <div className="space-y-1 text-sm text-gray-600">
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
        </div>
      )}

      {item.options && item.options.group_type !== 'Group' && Object.keys(item.options).length > 0 && (
        <div className="text-sm text-gray-600">
          {Object.entries(item.options).map(([k, v]) => (
            <div key={k}>
              {k}: <span className="font-medium">{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const totalPrice = item.price * item.quantity;

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
              src={hoverReady ? hoverUrl : (hoverUrl || thumbUrl)}
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
      </div>

      {/* 4) Quantity (editable) */}
      <div className="text-center">
        <div className="space-y-1">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={localQuantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
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
