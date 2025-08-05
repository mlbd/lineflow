'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { X, RefreshCw } from 'lucide-react';

// Cache object to store fetched logos
const logoCache = new Map();

export default function EditLogoPanel({
  open,
  onClose,
  onSelect,
  folder = 'logos', // <-- default folder, change as needed, or '' for all
}) {
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const observer = useRef();
  const scrollContainerRef = useRef();
  const loadingRef = useRef(false);

  const generateCacheKey = (pageNum, cursor, folderKey) =>
    `logo_page_${pageNum}_cursor_${cursor || 'null'}_folder_${folderKey || 'ALL'}`;

  // fetchLogos: fetches from API, caches, supports force refresh and folder param
  const fetchLogos = useCallback(
    async (pageNum = 1, cursor = null, reset = false, forceRefresh = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      const cacheKey = generateCacheKey(pageNum, cursor, folder);

      // Use cache unless forcing refresh
      if (!forceRefresh && logoCache.has(cacheKey)) {
        const cachedData = logoCache.get(cacheKey);
        if (reset) {
          setLogos(cachedData.logos);
          setHasMore(cachedData.hasMore);
          setNextCursor(cachedData.nextCursor);
          setPage(pageNum);
        } else {
          setLogos(prev => [...prev, ...cachedData.logos]);
          setHasMore(cachedData.hasMore);
          setNextCursor(cachedData.nextCursor);
          setPage(pageNum);
        }
        loadingRef.current = false;
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
        if (cursor) params.append('next_cursor', cursor);
        // Only include folder if not empty string
        if (folder && folder.trim() !== '') params.append('folder', folder);

        const response = await fetch(`/api/cloudinary/images?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch logos');
        }

        const newLogos = data.resources || [];
        const hasMoreLogos = !!data.pagination?.next_cursor;
        const newNextCursor = data.pagination?.next_cursor || null;

        logoCache.set(cacheKey, {
          logos: newLogos,
          hasMore: hasMoreLogos,
          nextCursor: newNextCursor,
          timestamp: Date.now(),
        });

        if (reset) {
          setLogos(newLogos);
        } else {
          setLogos(prev => [...prev, ...newLogos]);
        }

        setHasMore(hasMoreLogos);
        setNextCursor(newNextCursor);
        setPage(pageNum);
      } catch (err) {
        setError(err.message);
        if (reset) setLogos([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadingRef.current = false;
      }
    },
    [folder]
  );

  // Clear cache and refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    logoCache.clear();
    setLogos([]);
    setPage(1);
    setNextCursor(null);
    setHasMore(true);
    setError(null);
    setLoading(false);
    setLoadingMore(false);

    fetchLogos(1, null, true, true).finally(() => setRefreshing(false));
  }, [fetchLogos]);

  // Load initial logos when panel opens or folder changes
  useEffect(() => {
    if (open) {
      setLogos([]);
      setPage(1);
      setNextCursor(null);
      setHasMore(true);
      setError(null);
      setLoading(false);
      setLoadingMore(false);

      fetchLogos(1, null, true);
    }
  }, [open, folder, fetchLogos]);

  // Infinite scroll
  const lastLogoElementRef = useCallback(
    node => {
      if (loading || loadingMore || !hasMore) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        entries => {
          if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
            fetchLogos(page + 1, nextCursor);
          }
        },
        {
          threshold: 0.5,
          rootMargin: '20px',
        }
      );

      if (node) observer.current.observe(node);
    },
    [loading, loadingMore, hasMore, page, nextCursor, fetchLogos]
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
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Choose Logo</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            title="Refresh logos"
          >
            <RefreshCw size={18} className={`${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="p-4">
        <Input placeholder="Search logos (not functional yet)" />
      </div>

      <div
        ref={scrollContainerRef}
        className="px-4 space-y-2 overflow-y-auto h-[calc(100vh-150px)]"
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading logos...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">Error: {error}</div>
        ) : logos.length === 0 ? (
          <div className="text-sm text-muted-foreground">No logos found.</div>
        ) : (
          <>
            {logos.map((logo, index) => (
              <div
                key={logo.public_id}
                ref={index === logos.length - 1 ? lastLogoElementRef : null}
                onClick={() => {
                  onSelect(logo.public_id);
                  onClose();
                }}
                className="cursor-pointer border rounded hover:bg-muted transition p-2"
              >
                <img
                  src={logo.url}
                  alt={logo.public_id}
                  className="w-full h-auto rounded bg-gray-100"
                  loading="lazy"
                />
                <div className="text-xs text-gray-500 mt-1 truncate">{logo.public_id}</div>
              </div>
            ))}
            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
              </div>
            )}
            {!hasMore && logos.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">No more logos</div>
            )}
          </>
        )}
      </div>

      {logos.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-50 px-4 py-2 border-t">
          <div className="text-xs text-muted-foreground text-center">
            Showing {logos.length} logos
          </div>
        </div>
      )}
    </div>
  );
}
