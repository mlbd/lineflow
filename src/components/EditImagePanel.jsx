'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { X, RefreshCw } from 'lucide-react';
import Image from 'next/image';

// Cache object to store fetched images
const imageCache = new Map();

export default function EditImagePanel({ open, onClose, onSelect }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const observer = useRef();
  const scrollContainerRef = useRef();

  const generateCacheKey = (pageNum, cursor) => {
    return `page_${pageNum}_cursor_${cursor || 'null'}`;
  };

  const fetchImages = useCallback(
    async (pageNum = 1, cursor = null, reset = false, forceRefresh = false) => {
      if (loading || loadingMore) return;

      const cacheKey = generateCacheKey(pageNum, cursor);
      if (!forceRefresh && imageCache.has(cacheKey)) {
        const cachedData = imageCache.get(cacheKey);
        if (reset) {
          setImages(cachedData.images);
          setHasMore(cachedData.hasMore);
          setNextCursor(cachedData.nextCursor);
          setPage(pageNum);
        } else {
          setImages(prev => [...prev, ...cachedData.images]);
          setHasMore(cachedData.hasMore);
          setNextCursor(cachedData.nextCursor);
          setPage(pageNum);
        }
        return;
      }

      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: '3',
        });

        if (cursor) {
          params.append('next_cursor', cursor);
        }

        const response = await fetch(`/api/cloudinary/images?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch images');
        }

        const newImages = data.resources || [];
        const hasMoreImages = newImages.length === 3 && data.pagination?.has_more !== false;
        const newNextCursor = data.pagination?.next_cursor || null;

        imageCache.set(cacheKey, {
          images: newImages,
          hasMore: hasMoreImages,
          nextCursor: newNextCursor,
          timestamp: Date.now(),
        });

        if (reset) {
          setImages(newImages);
        } else {
          setImages(prev => [...prev, ...newImages]);
        }

        setHasMore(hasMoreImages);
        setNextCursor(newNextCursor);
        setPage(pageNum);
      } catch (err) {
        setError(err.message);
        if (reset) {
          setImages([]);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [loading, loadingMore] // Fixed: add all deps used in this function
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    imageCache.clear();
    setImages([]);
    setPage(1);
    setNextCursor(null);
    setHasMore(true);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
    fetchImages(1, null, true, true).finally(() => {
      setRefreshing(false);
    });
  }, [fetchImages]);

  useEffect(() => {
    if (open) {
      setImages([]);
      setPage(1);
      setNextCursor(null);
      setHasMore(true);
      setError(null);
      setLoading(false);
      setLoadingMore(false);
      fetchImages(1, null, true);
    }
  }, [open, fetchImages]);

  const lastImageElementRef = useCallback(
    node => {
      if (loading || loadingMore || !hasMore) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        entries => {
          if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
            fetchImages(page + 1, nextCursor);
          }
        },
        {
          threshold: 0.5,
          rootMargin: '20px',
        }
      );

      if (node) observer.current.observe(node);
    },
    [loading, loadingMore, hasMore, page, nextCursor, fetchImages]
  );

  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  return (
    <div
      className={`fixed top-0 left-0 h-screen w-[300px] bg-white shadow-lg z-50 border-r transform transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Choose Image</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh images"
          >
            <RefreshCw size={18} className={`${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="cursor-pointer">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="p-4">
        <Input placeholder="Search (not functional yet)" />
      </div>

      <div
        ref={scrollContainerRef}
        className="px-4 space-y-2 overflow-y-auto h-[calc(100vh-150px)]"
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading images...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">Error: {error}</div>
        ) : images.length === 0 ? (
          <div className="text-sm text-muted-foreground">No images found.</div>
        ) : (
          <>
            {images.map((img, index) => (
              <div
                key={img.public_id}
                ref={index === images.length - 1 ? lastImageElementRef : null}
                onClick={() => {
                  onSelect(img.url);
                  onClose();
                }}
                className="cursor-pointer border rounded hover:bg-muted transition"
              >
                <Image
                  src={img.url}
                  alt={img.public_id}
                  width={img.width || 400}
                  height={img.height || 300}
                  className="w-full h-auto rounded"
                  loading="lazy"
                />
              </div>
            ))}
            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
              </div>
            )}
            {!hasMore && images.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">No more images</div>
            )}
          </>
        )}
      </div>
      {images.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-50 px-4 py-2 border-t">
          <div className="text-xs text-muted-foreground text-center">
            Showing {images.length} images
          </div>
        </div>
      )}
    </div>
  );
}
