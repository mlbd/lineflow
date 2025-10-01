import React from 'react';
import Marquee from 'react-fast-marquee';

/**
 * CompanySlider
 * - Seamless, infinite, autoplaying marquee (works on iOS).
 * - Logos are centered both vertically & horizontally regardless of size.
 * - Adjustable speed & direction.
 *
 * Props:
 *  - title?: string
 *  - logos: Array<{ src: string; alt?: string }>
 *  - speed?: number               // pixels per second (default 30)
 *  - direction?: "left" | "right" // default "left" (content moves left)
 *  - pauseOnHover?: boolean       // default false
 *  - gradient?: boolean           // default true (subtle fade edges)
 *  - gradientWidth?: number       // default 80 (px)
 *  - className?: string           // extra classes for outer wrapper
 */
export default function CompanySlider({
  title = 'Most Popular Companies Trust Us',
  logos = [],
  speed = 30,
  direction = 'left',
  pauseOnHover = false,
  gradient = true,
  gradientWidth = 80,
  className = '',
}) {
  const items = logos.length
    ? logos
    : [
        // Fallback placeholders (use your real logos)
        { src: '/logos/lime.png', alt: 'Lime' },
        { src: '/logos/amazon.png', alt: 'Amazon' },
        { src: '/logos/ofran.png', alt: 'Ofran' },
        { src: '/logos/company.png', alt: 'Company Logo' },
        { src: '/logos/logo1.png', alt: 'Logo 1' },
        { src: '/logos/logo2.png', alt: 'Logo 2' },
      ];

  return (
    <section
      className={`w-full px-6 sm:px-10 lg:px-20 py-12 sm:py-16 lg:py-24 ${className}`}
      aria-label="Company logos carousel"
    >
      {!!title && (
        <h2 className="text-center text-secondary text-2xl sm:text-3xl font-bold mb-8">{title}</h2>
      )}

      <div className="container mx-auto">
        <div className="relative">
          <Marquee
            autoFill
            direction={direction}
            speed={speed}
            pauseOnHover={pauseOnHover}
            gradient={gradient}
            gradientWidth={gradientWidth}
            // Ensures it never stops or snaps; iOS friendly because it's CSS animation
            className="overflow-hidden"
          >
            {/* Each logo cell is a fixed-height, flex box for perfect centering */}
            {items.map((item, i) => (
              <div
                key={`${item.src}-${i}`}
                className="mx-8 sm:mx-10 lg:mx-12 flex items-center justify-center h-16 sm:h-20 lg:h-24"
                style={{ width: 'clamp(120px, 12vw, 220px)' }}
              >
                <img
                  src={item.src}
                  alt={item.alt || 'Company logo'}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}
