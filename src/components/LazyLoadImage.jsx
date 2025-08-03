import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// Skeleton component with wave animation
const ImageSkeleton = ({ className, aspectRatio = '16/9' }) => {
  return (
    <div
      className={cn('relative overflow-hidden bg-gray-200 rounded', className)}
      style={{ aspectRatio }}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
      <style jsx>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
};

// Enhanced Lazy loading image component
const LazyLoadImage = ({
  src,
  alt,
  className,
  aspectRatio = '16/9',
  onLoad,
  onError,
  forceReload = false,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isReloading, setIsReloading] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  // Reset states when src changes
  useEffect(() => {
    if (src !== currentSrc) {
      setIsReloading(true);
      setIsLoaded(false);
      setIsError(false);
      setCurrentSrc(src);

      // Add a small delay to show the reloading state
      const timer = setTimeout(() => {
        setIsReloading(false);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [src, currentSrc]);

  // Intersection observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Force reload when forceReload prop changes
  useEffect(() => {
    if (forceReload && isLoaded) {
      setIsLoaded(false);
      setIsError(false);
      setIsReloading(true);

      const timer = setTimeout(() => {
        setIsReloading(false);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [forceReload, isLoaded]);

  const handleLoad = e => {
    setIsLoaded(true);
    setIsReloading(false);
    onLoad?.(e);
  };

  const handleError = e => {
    setIsError(true);
    setIsReloading(false);
    onError?.(e);
  };

  const showSkeleton = (!isLoaded && !isError) || isReloading;

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden w-full', showSkeleton && 'min-h-[200px]')}
    >
      {/* Skeleton loader */}
      {showSkeleton && <div className="skeleton-loader"></div>}

      {/* Actual image */}
      {isVisible && !isReloading && (
        <Image
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          className={cn(
            className,
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
          )}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      )}

      {/* Error fallback */}
      {isError && !isReloading && (
        <div
          className={cn('flex items-center justify-center bg-gray-100 text-gray-500', className)}
          style={{ aspectRatio }}
        >
          <span className="text-sm">Failed to load image</span>
        </div>
      )}

      {/* Reloading indicator */}
      {isReloading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            Updating...
          </div>
        </div>
      )}
    </div>
  );
};

export default LazyLoadImage;
