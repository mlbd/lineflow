import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const ImageModal = ({
  isOpen,
  onClose,
  logos = [],
  currentIndex = 0,
  onPrev,
  onNext
}) => {
  const logo = logos[currentIndex] || {};
  const { thumbnailUrl: src, title, public_id } = logo;
  const alt = title || '';

  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && src) {
      setLoading(true);
      const img = new window.Image();
      img.onload = () => {
        setImageDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        setLoading(false);
      };
      img.onerror = () => setLoading(false);
      img.src = src;
    }
  }, [isOpen, src, public_id]);

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

  const getDisplayDimensions = () => {
    if (!imageDimensions.width || !imageDimensions.height) {
      return { width: 'auto', height: 'auto' };
    }

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const maxWidth = Math.min(screenWidth * 0.8, imageDimensions.width);
    const widthScale = maxWidth / imageDimensions.width;
    const height = imageDimensions.height * widthScale;

    return {
      width: Math.round(imageDimensions.width * widthScale),
      height: Math.round(height),
    };
  };

  const displayDimensions = getDisplayDimensions();

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
    // Do NOT set position: 'relative' here
  }}
>
  <div className="relative m-auto" style={{ width: displayDimensions.width }}>
    {/* Close Button */}
    <DialogClose asChild>
      <button className="absolute top-2 right-2 z-30 bg-white rounded-full p-1 shadow cursor-pointer">
        <X size={20} />
      </button>
    </DialogClose>

    {/* Prev Button */}
    <button
      onClick={onPrev}
      disabled={currentIndex === 0}
      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-2 shadow hover:bg-gray-100"
      style={{ opacity: currentIndex === 0 ? 0.5 : 1 }}
    >
      <ChevronLeft size={32} />
    </button>
    {/* Next Button */}
    <button
      onClick={onNext}
      disabled={currentIndex === logos.length - 1}
      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white rounded-full p-2 shadow hover:bg-gray-100"
      style={{ opacity: currentIndex === logos.length - 1 ? 0.5 : 1 }}
    >
      <ChevronRight size={32} />
    </button>

    {/* Image */}
    {!loading && (
      <img
        src={src}
        alt={alt}
        width={displayDimensions.width}
        height={displayDimensions.height}
        style={{ width: displayDimensions.width, height: displayDimensions.height }}
        className="block w-full h-auto"
      />
    )}
    {loading && (
      <div className="w-full h-full flex items-center justify-center">
        <span>Loading...</span>
      </div>
    )}
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
};

export default ImageModal;
