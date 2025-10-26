// ProductColorBoxes.jsx
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

export default function ProductColorBoxes({ acf, onBoxClick = () => {}, onBoxHover = () => {} }) {
  const wrapperRef = useRef(null);
  const [layoutData, setLayoutData] = useState({
    perLine: 0,
    totalLines: 0,
  });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    let frameId = 0;
    let resizeObserver;

    const calculateLayout = () => {
      // Guard every time this runs (handlers can fire when ref is null)
      if (!wrapperRef.current) return;

      const nodeList = wrapperRef.current.querySelectorAll('.singleColorBox');
      if (!nodeList || nodeList.length === 0) return;

      const boxes = Array.from(nodeList);

      let currentTop = boxes[0].offsetTop;
      let perLine = 0;
      let lineCount = 1;

      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].offsetTop === currentTop) {
          if (lineCount === 1) perLine++; // only count first line
        } else {
          currentTop = boxes[i].offsetTop;
          lineCount++;
        }
      }

      setLayoutData({ perLine, totalLines: lineCount });
    };

    // Run after next paint to ensure DOM is laid out
    const schedule = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(calculateLayout);
    };

    // Initial
    schedule();

    // Viewport & fullscreen listeners
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    document.addEventListener('fullscreenchange', schedule);
    document.addEventListener('webkitfullscreenchange', schedule);
    document.addEventListener('mozfullscreenchange', schedule);
    document.addEventListener('MSFullscreenChange', schedule);

    // Observe wrapper size changes
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(el);
    }

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      document.removeEventListener('fullscreenchange', schedule);
      document.removeEventListener('webkitfullscreenchange', schedule);
      document.removeEventListener('mozfullscreenchange', schedule);
      document.removeEventListener('MSFullscreenChange', schedule);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [acf?.color]);


  // [PATCH] Helper to dispatch clicks (mouse/keyboard)
  const triggerBoxClick = (clr, index, event) => {
    try {
      onBoxClick({ color: clr, index, event, allColors: acf?.color || [] });
    } catch (e) {
      // swallow to avoid UI crashes if a consumer throws
      // console.error('onBoxClick error:', e);
    }
  };

  // Only render if group_type === "Group" and color is non-empty array
  if (acf?.group_type === 'Group' && Array.isArray(acf.color) && acf.color.length > 0) {
    // Limit to perLine boxes, or show all if perLine is 0 (not calculated yet)
    const visibleColors =
      layoutData.perLine > 0 ? acf.color.slice(0, layoutData.perLine) : acf.color;

    const isMoreThanOneLine = acf.color.length > layoutData.perLine;
    const reserveSpace = 2;
    const showPerLine = layoutData.perLine - reserveSpace;
    let showMoreCount = isMoreThanOneLine ? acf.color.length - showPerLine : 0;

    return (
      <div
        ref={wrapperRef}
        className="colorBoxWrapper flex flex-wrap gap-[9px] mb-2 justify-start items-center"
        data-per-line={layoutData.perLine}
        data-line-number={layoutData.totalLines}
        data-showMoreCount={showMoreCount}
        data-showPerLine={showPerLine}
        data-total={acf?.color.length}
      >
        {visibleColors.map((clr, idx) => {
          const hiddenByCap = showMoreCount > reserveSpace && idx >= showPerLine;
          const label = clr?.title || `Color ${idx + 1}`;

          return (
            <div
              key={idx}
              className={`singleColorBox size-8 p-0.5 rounded-[5px] cursor-pointer shadow-[0_0_0_2px_white,0_0_0_3px_#cccccc] hover:shadow-[0_0_0_2px_white,0_0_0_3px_#111111] transition-shadow${
                hiddenByCap ? ' absolute invisible opacity-0' : ''
              }`}
              style={{ background: clr?.color_hex_code || '#fff' }}
              title={label}
              role="button"
              tabIndex={hiddenByCap ? -1 : 0}
              aria-label={label}
              onClick={(e) => triggerBoxClick(clr, idx, e)}
              onMouseEnter={(e) => {
                try {
                  // notify parent to preview this color (catalog hover)
                  onBoxHover?.(clr, idx, e);
                } catch (_) {}
              }}
              onMouseLeave={(e) => {
                try {
                  // clear hover preview
                  onBoxHover?.(null, null, e);
                } catch (_) {}
              }}
              onFocus={(e) => {
                // keyboard accessibility: treat focus like hover
                try {
                  onBoxHover?.(clr, idx, e);
                } catch (_) {}
              }}
              onBlur={(e) => {
                try {
                  onBoxHover?.(null, null, e);
                } catch (_) {}
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  triggerBoxClick(clr, idx, e);
                }
              }}
            />
          );
        })}

        {showMoreCount > reserveSpace && (
          <button
            className="text-sm text-primary font-medium hover:no-underline"
            type="button"
            // [PATCH] Optional: still capped UI, but allow parent to open a modal if desired
            onClick={(e) => triggerBoxClick({ __type: 'see_more' }, showPerLine, e)}
          >
            + {showMoreCount} More
          </button>
        )}
      </div>
    );
  }

  // Fallback: single color or no colors
  return (
    <div className="text-sm border text-deepblue rounded-md font-normal bg-deepblue-light mb-2 px-2 py-1 text-center">
      <Image
        src="/info-icon.svg"
        alt="Info"
        width={16}
        height={16}
        className="w-[16px] h-[16px] inline-block mr-2"
      />
      Available in one color as shown
    </div>
  );
}
