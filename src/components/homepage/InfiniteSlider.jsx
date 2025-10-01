'use client';
import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

export default function InfiniteSlider({ slides = [], options = {}, className = '' }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    slidesToScroll: 1,
    ...options,
  });

  const [ready, setReady] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (emblaApi) setReady(true);
  }, [emblaApi]);

  return (
    <div className={`relative ${className}`}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((src, i) => (
            <div key={i} className="shrink-0 basis-full lg:basis-1/3 p-5">
              <div className="h-[360px] rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center">
                <img
                  src={src}
                  alt={`Slide ${i + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={scrollPrev}
        aria-label="Previous slide"
        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-white/90 shadow ring-1 ring-black/10 hover:ring-black/20 transition disabled:opacity-50"
        disabled={!ready}
      >
        <svg
          viewBox="0 0 24 24"
          className="mx-auto h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        type="button"
        onClick={scrollNext}
        aria-label="Next slide"
        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-white/90 shadow ring-1 ring-black/10 hover:ring-black/20 transition disabled:opacity-50"
        disabled={!ready}
      >
        <svg
          viewBox="0 0 24 24"
          className="mx-auto h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
