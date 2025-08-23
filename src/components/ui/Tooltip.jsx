'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// <Tooltip content="הסר פריט">
//   <button
//     onClick={() => removeItem(idx)}
//     className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
//     aria-label="הסר פריט"
//   >
//     <Trash2 className="w-5 h-5" />
//   </button>
// </Tooltip>

export default function Tooltip({
  children,
  content,
  delay = 120,
  className = '',
  maxWidth = 320,
  offset = 10, // gap between anchor and tooltip
  placement = 'auto', // 'auto' | 'top' | 'bottom'
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    placement: 'top',
    arrowX: 0, // px within tooltip box
  });

  const anchorRef = useRef(null);
  const tipRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      clearTimeout(timerRef.current);
    };
  }, []);

  const show = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timerRef.current);
    setOpen(false);
  };

  // Recalculate on open/resize/scroll/content changes
  useEffect(() => {
    if (!open || !anchorRef.current) return;

    const calc = () => {
      const a = anchorRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const pad = 4;

      // Ensure tooltip exists to measure
      const tipEl = tipRef.current;
      if (!tipEl) return;

      // Measure actual tooltip size
      const { width: tw, height: th } = tipEl.getBoundingClientRect();

      // Target: center horizontally to anchor’s center
      let desiredLeft = a.left + a.width / 2 - tw / 2;
      // Clamp within viewport
      let left = Math.min(Math.max(desiredLeft, pad), Math.max(vw - tw - pad, pad));

      // Preferred placement
      let place = placement === 'auto' ? 'top' : placement;

      // Compute top/bottom
      let top = a.top - th - offset;
      if (place === 'bottom' || (place === 'auto' && top < pad)) {
        place = 'bottom';
        top = a.bottom + offset;
      } else {
        place = 'top';
      }

      // Arrow X should point to the anchor’s center, but stay inside tooltip
      const anchorCenterX = a.left + a.width / 2;
      let arrowX = anchorCenterX - left; // in tooltip local coords
      const arrowPad = 12;
      arrowX = Math.min(Math.max(arrowX, arrowPad), tw - arrowPad);

      setCoords({ top, left, placement: place, arrowX });
    };

    // position after paint so tip size is accurate
    const frame = requestAnimationFrame(calc);

    const onScroll = () => calc();
    const onResize = () => calc();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, content, maxWidth, offset, placement]);

  return (
    <>
      <span
        ref={anchorRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </span>

      {mounted &&
        open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[9999] pointer-events-none"
            style={{ top: coords.top, left: coords.left, maxWidth }}
          >
            <div
              ref={tipRef}
              className={[
                // box
                'relative rounded-lg border border-gray-200 bg-white/95 backdrop-blur px-3 py-2 text-sm text-gray-800 shadow-xl',
                // motion (slight lift depending on side)
                coords.placement === 'top'
                  ? 'animate-[tooltipInTop_120ms_ease-out] will-change-transform'
                  : 'animate-[tooltipInBottom_120ms_ease-out] will-change-transform',
                className,
              ].join(' ')}
              style={{ maxWidth }}
            >
              {content}

              {/* Arrow */}
              <span
                className={[
                  'absolute w-3 h-3 bg-white border border-gray-200 rotate-45',
                  coords.placement === 'top' ? 'bottom-[-7px]' : 'top-[-7px]',
                ].join(' ')}
                style={{ left: coords.arrowX - 6 /* center the 12px arrow */ }}
              />
            </div>

            {/* tiny CSS keyframes (scoped to this portal content) */}
            <style jsx>{`
              @keyframes tooltipInTop {
                from {
                  opacity: 0;
                  transform: translateY(4px) scale(0.98);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
              @keyframes tooltipInBottom {
                from {
                  opacity: 0;
                  transform: translateY(-4px) scale(0.98);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
            `}</style>
          </div>,
          document.body
        )}
    </>
  );
}
