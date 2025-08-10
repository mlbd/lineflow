'use client';
import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import * as ReactDOM from 'react-dom';

export default function ImageGalleryOverlay({
  open = false,
  initialIndex = 0,
  images = [],
  onClose = () => {},
}) {
  const [idx, setIdx] = useState(initialIndex);
  const [loading, setLoading] = useState(true);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    setIdx(initialIndex);
    setLoading(true);
  }, [open, initialIndex]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 🔒 Block Radix Dialog "outside pointer down" while overlay is open
  useEffect(() => {
    if (!open) return;

    // Use capture so we win before Radix catches it
    const block = e => {
      // Don't preventDefault so buttons still work; just stop propagation
      e.stopPropagation();
    };
    document.addEventListener('pointerdown', block, true);
    document.addEventListener('mousedown', block, true);
    document.addEventListener('touchstart', block, true);

    return () => {
      document.removeEventListener('pointerdown', block, true);
      document.removeEventListener('mousedown', block, true);
      document.removeEventListener('touchstart', block, true);
    };
  }, [open]);

  // Keyboard controls
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, images.length, onClose]);

  // Preload current + neighbors
  useEffect(() => {
    if (!open || !images[idx]?.src) return;
    setLoading(true);
    const current = new Image();
    current.onload = () => setLoading(false);
    current.onerror = () => setLoading(false);
    current.src = images[idx].src;

    const n = new Image();
    n.src = images[(idx + 1) % images.length]?.src || '';
    const p = new Image();
    p.src = images[(idx - 1 + images.length) % images.length]?.src || '';
  }, [open, idx, images]);

  if (!open) return null;

  const stopAll = e => {
    // Extra guard to avoid bubbling to document listeners
    e.stopPropagation();
  };

  const body = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 pointer-events-auto"
      aria-modal="true"
      role="dialog"
      // Capture here too (belt & suspenders)
      onPointerDownCapture={stopAll}
      onMouseDownCapture={stopAll}
      onTouchStartCapture={stopAll}
      onClick={() => onClose()}
    >
      {/* Content wrapper: prevent backdrop close when clicking inside */}
      <div
        className="relative w-full h-full flex items-center justify-center"
        onClick={e => e.stopPropagation()}
        onPointerDownCapture={stopAll}
        onMouseDownCapture={stopAll}
        onTouchStartCapture={stopAll}
      >
        {/* Close */}
        <button
          type="button"
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-full bg-white/90 hover:bg-white shadow focus:outline-none focus:ring-2 focus:ring-sky-500"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Prev */}
        {images.length > 1 && (
          <button
            type="button"
            aria-label="Previous"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 hover:bg-white shadow"
            onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next */}
        {images.length > 1 && (
          <button
            type="button"
            aria-label="Next"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 hover:bg-white shadow"
            onClick={() => setIdx(i => (i + 1) % images.length)}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Image */}
        <div className="max-w-[95vw] max-h-[85vh] flex items-center justify-center">
          <img
            src={images[idx]?.src}
            alt={images[idx]?.alt || `Image ${idx + 1}`}
            className={`max-w-[95vw] max-h-[85vh] object-contain transition-opacity duration-200 ${loading ? 'opacity-60' : 'opacity-100'}`}
            draggable={false}
          />
        </div>

        {/* Loader */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 border-4 border-white/40 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
            {idx + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(body, document.body);
}
