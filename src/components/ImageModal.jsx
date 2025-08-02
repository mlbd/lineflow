import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from "next/image";

const DEFAULT_MIN_HEIGHT = 350; // px, adjust for your expected image sizes

export default function ImageModal({
  isOpen,
  onClose,
  logos = [],
  currentIndex = 0,
  onPrev,
  onNext
}) {
  const logo = logos[currentIndex] || {};
  const { thumbnailUrl: src, title } = logo;
  const alt = title || '';

  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [fade, setFade] = useState(true);

  // Track max height for minHeight (to prevent collapse)
  const [maxHeight, setMaxHeight] = useState(DEFAULT_MIN_HEIGHT);

  useEffect(() => {
    if (isOpen && src) {
      setLoading(true);
      setFade(false); // hide image immediately
      const img = new window.Image();
      img.onload = () => {
        setImageDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        setLoading(false);
        setTimeout(() => setFade(true), 20); // trigger fade-in after image load
        setMaxHeight(h => Math.max(h, img.naturalHeight));
      };
      img.onerror = () => setLoading(false);
      img.src = src;
    }
  }, [isOpen, src]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onPrev, onNext, onClose]);

  // Layout sizing
  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const maxWidth = Math.min(screenWidth * 0.8, imageDimensions.width || 700);
  const widthScale = imageDimensions.width ? maxWidth / imageDimensions.width : 1;
  const imgHeight = imageDimensions.height ? Math.round(imageDimensions.height * widthScale) : DEFAULT_MIN_HEIGHT;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="p-0 [&>button]:hidden"
        style={{
          width: '100vw',
          height: '100vh',
          overflowY: 'auto',
          maxWidth: '100vw',
          backgroundColor: 'transparent',
          paddingTop: '40px',
          paddingBottom: '40px',
        }}
      >
        <div
          className="relative m-auto flex flex-col items-center"
          style={{
            width: maxWidth,
            minHeight: maxHeight || DEFAULT_MIN_HEIGHT,
            transition: 'min-height 0.3s',
          }}
        >
          {/* Close button */}
          <DialogClose asChild>
            <button className="absolute top-2 right-2 z-30 bg-white rounded-full p-1 shadow cursor-pointer">
              <X size={20} />
            </button>
          </DialogClose>
          {/* Prev button */}
          <button
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-2 shadow hover:bg-gray-100"
            style={{ opacity: currentIndex === 0 ? 0.5 : 1 }}
          >
            <ChevronLeft size={32} />
          </button>
          {/* Next button */}
          <button
            onClick={onNext}
            disabled={currentIndex === logos.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-2 shadow hover:bg-gray-100"
            style={{ opacity: currentIndex === logos.length - 1 ? 0.5 : 1 }}
          >
            <ChevronRight size={32} />
          </button>
          {/* Image or Loader */}
          <div
            className="flex items-center justify-center w-full"
            style={{
              height: imgHeight,
              minHeight: DEFAULT_MIN_HEIGHT,
              position: 'relative',
            }}
          >
            {!loading && src && (
              <Image
                src={src}
                alt={alt}
                width={maxWidth}
                height={imgHeight}
                className={`block w-full h-auto transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`}
                style={{ width: maxWidth, height: imgHeight }}
                unoptimized
              />
            )}
            {loading && (
              <div className="w-full h-full flex items-center justify-center absolute top-0 left-0 bg-white/60">
                <span className="animate-spin border-2 border-blue-400 border-t-transparent rounded-full w-10 h-10" />
              </div>
            )}
          </div>
          {/* Image title/caption */}
          <div className="text-center mt-4 font-semibold text-lg">
            {title}
            <div className="text-gray-400 text-xs mt-1">
              {currentIndex + 1} / {logos.length}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
