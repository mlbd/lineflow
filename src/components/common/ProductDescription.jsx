// src/components/common/ProductDescription.jsx
// Fixed: no conditional Hook calls. Keeps line-clamp + "… Show More" overlay.
import { useEffect, useRef, useState } from 'react';
import he from 'he';

// Convert any HTML-ish string to plain text (SSR + CSR safe)
function htmlToText(input = '') {
  if (!input) return '';
  // Try DOMParser in the browser for robust stripping
  if (typeof window !== 'undefined' && 'DOMParser' in window) {
    const doc = new DOMParser().parseFromString(String(input), 'text/html');
    return he.decode((doc.body?.textContent || '').trim());
  }
  // Fallback on the server: crude tag strip + decode entities
  const stripped = String(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ');
  return he.decode(stripped.trim());
}

export default function ProductDescription({
  p,
  className = '',
  // control how many lines are shown (0/undefined = no clamp)
  limitLines = 0,
  // labels for actions
  moreLabel = 'Show More',
}) {
  // ——— derive inputs (safe even if p is null) ———
  const raw =
    (typeof p?.description === 'string' && p.description.trim()) ||
    (typeof p?.acf?.product_description === 'string' && p.acf.product_description.trim()) ||
    (typeof p?.pricing_description === 'string' && p.pricing_description.trim()) ||
    '';

  const text = htmlToText(raw);
  const shouldRender = Boolean(text);

  // ——— hooks must always run in the same order ———
  const boxRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    // If we have nothing to render or no clamp, no need to measure
    if (!shouldRender || limitLines <= 0) return;

    const el = boxRef.current;
    if (!el) return;

    const check = () => {
      // With clamp styles applied, scrollHeight > clientHeight indicates overflow.
      setIsOverflowing(el.scrollHeight > el.clientHeight + 1); // +1 to avoid float rounding issues
    };

    // Run after paint
    let rafId = 0;
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      rafId = window.requestAnimationFrame(check);
    } else {
      // SSR/no RAF fallback
      check();
    }

    // Re-check on resize / container width changes
    let ro;
    const hasRO = typeof window !== 'undefined' && 'ResizeObserver' in window;
    if (hasRO) {
      ro = new ResizeObserver(check);
      ro.observe(el);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', check);
    }

    return () => {
      if (typeof window !== 'undefined' && rafId) window.cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      else if (typeof window !== 'undefined') window.removeEventListener('resize', check);
    };
  }, [shouldRender, text, limitLines]);

  // ——— computed styles ———
  const clampStyle =
    limitLines > 0
      ? {
          display: '-webkit-box',
          WebkitLineClamp: String(limitLines),
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }
      : undefined;

  // ——— final render ———
  if (!shouldRender) return null;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={boxRef}
        className="text-[#4b4b4b] text-base font-normal leading-snug"
        style={clampStyle}
      >
        {text}
      </div>

      {/* Only show the trailing ellipsis + "Show More" when actually overflowing and clamped */}
      {limitLines > 0 && isOverflowing && (
        <div
          className="pointer-events-none absolute bottom-0 right-0 flex items-center gap-1 pl-1
                      bg-white dark:bg-[#1F1F1F]"
        >
          <span aria-hidden>…</span>
          <button
            type="button"
            className="pointer-events-auto underline text-blue-600 dark:text-blue-400 text-sm leading-none"
            onClick={() => {
              // Hook expand/collapse here if/when needed.
            }}
          >
            {moreLabel}
          </button>
        </div>
      )}
    </div>
  );
}
