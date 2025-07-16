import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { X } from 'lucide-react';

const ImageModal = ({ isOpen, onClose, src, alt, title }) => {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && src) {
      setLoading(true);
      const img = new Image();
      img.onload = () => {
        setImageDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        setLoading(false);
      };
      img.onerror = () => {
        setLoading(false);
      };
      img.src = src;
    }
  }, [isOpen, src]);

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
        }}
      >
        <div className="relative m-auto" style={{
          width: displayDimensions.width
        }}>
          <DialogClose asChild>
            <button className="absolute top-2 right-2 z-10 bg-white rounded-full p-1 shadow cursor-pointer">
              <X size={20} />
            </button>
          </DialogClose>

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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageModal;
