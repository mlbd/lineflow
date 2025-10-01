import Image from 'next/image';
import { useRef, useEffect, useState } from 'react';

export default function ProductColorBoxes({ acf }) {
  const wrapperRef = useRef(null);
  const [layoutData, setLayoutData] = useState({
    perLine: 0,
    totalLines: 0,
  });

  useEffect(() => {
    if (!wrapperRef.current) return;

    const calculateLayout = () => {
      const boxes = wrapperRef.current.querySelectorAll('.singleColorBox');
      if (boxes.length === 0) return;

      let currentTop = boxes[0].offsetTop;
      let perLine = 0;
      let lineCount = 1;

      // Calculate boxes per line by checking when offsetTop changes
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].offsetTop === currentTop) {
          if (lineCount === 1) perLine++; // Count only first line
        } else {
          currentTop = boxes[i].offsetTop;
          lineCount++;
        }
      }

      setLayoutData({
        perLine,
        totalLines: lineCount,
      });
    };

    // Calculate on mount
    calculateLayout();

    // Add multiple event listeners to catch all viewport changes
    window.addEventListener('resize', calculateLayout);
    window.addEventListener('orientationchange', calculateLayout);

    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', calculateLayout);
    document.addEventListener('webkitfullscreenchange', calculateLayout);
    document.addEventListener('mozfullscreenchange', calculateLayout);
    document.addEventListener('MSFullscreenChange', calculateLayout);

    // Use ResizeObserver as a fallback for more reliable detection
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined' && wrapperRef.current) {
      resizeObserver = new ResizeObserver(calculateLayout);
      resizeObserver.observe(wrapperRef.current);
    }

    return () => {
      window.removeEventListener('resize', calculateLayout);
      window.removeEventListener('orientationchange', calculateLayout);
      document.removeEventListener('fullscreenchange', calculateLayout);
      document.removeEventListener('webkitfullscreenchange', calculateLayout);
      document.removeEventListener('mozfullscreenchange', calculateLayout);
      document.removeEventListener('MSFullscreenChange', calculateLayout);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [acf?.color]);

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
        {visibleColors.map((clr, idx) => (
          <div
            key={idx}
            className={`singleColorBox size-8 p-0.5 rounded-[5px] cursor-pointer shadow-[0_0_0_2px_white,0_0_0_3px_#cccccc] hover:shadow-[0_0_0_2px_white,0_0_0_3px_#111111] transition-shadow${
              showMoreCount > reserveSpace && idx >= showPerLine
                ? ' absolute invisible opacity-0'
                : ''
            }`}
            style={{
              background: clr.color_hex_code || '#fff',
            }}
            title={clr.title || ''}
          />
        ))}
        {showMoreCount > reserveSpace && (
          <button
            className="text-sm text-primary font-medium hover:no-underline"
            onClick={() => {
              /* Add your see more logic here */
            }}
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
