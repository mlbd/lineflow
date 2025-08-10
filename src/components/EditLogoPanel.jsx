'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { X, RefreshCw } from 'lucide-react';

const pageCache = new Map();

function isCloudinaryUrl(u = '') {
  return /cloudinary\.com/i.test(u);
}

function getPublicIdFromCloudinaryUrl(url) {
  // Try to extract the part after /v123456/ and strip extension
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    // Skip any transformation segments like "images/f_auto,q_auto"
    const vIdx = parts.findIndex(p => /^v\d+$/i.test(p));
    const after = vIdx >= 0 ? parts.slice(vIdx + 1) : parts;

    // Heuristic: if last segment has extension, strip it; otherwise use last segment
    let candidate = after[after.length - 1] || '';
    candidate = candidate.replace(/\.[a-z0-9]+$/i, '');
    return candidate;
  } catch {
    return '';
  }
}

export default function EditLogoPanel({
  open,
  onClose,
  onSelect,
  wpUrl, // <-- must pass from page.jsx
}) {
  const [items, setItems] = useState([]); // enriched items (with logo_darker)
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const observer = useRef();
  const busyRef = useRef(false);

  const cacheKey = (p, q) => `wp_pages_${p}_q_${(q || '').toLowerCase()}`;

  // Fetch a single batch of WP pages, filter by profile_picture_id (Cloudinary), then hydrate via company-page
  const fetchBatch = useCallback(
    async (pageNum = 1, reset = false, forceRefresh = false) => {
      if (busyRef.current) return;
      busyRef.current = true;

      const key = cacheKey(pageNum, query);

      if (!forceRefresh && pageCache.has(key)) {
        const cached = pageCache.get(key);
        if (reset) setItems(cached.items);
        else setItems(prev => [...prev, ...cached.items]);
        setHasMore(cached.hasMore);
        setPage(pageNum);
        busyRef.current = false;
        return;
      }

      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        // 1) Get raw WP pages (50 per page)
        const params = new URLSearchParams({
          per_page: '50',
          page: String(pageNum),
          _fields: 'id,slug,title,acf',
        });
        const res = await fetch(`${wpUrl}/wp-json/wp/v2/pages?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message || `Failed to load pages (HTTP ${res.status})`);
        }
        const raw = await res.json();

        // 2) Filter by acf.profile_picture_id existing + cloudinary
        const filteredByPFP = (raw || []).filter(p => {
          const pfp = p?.acf?.profile_picture_id;
          return typeof pfp === 'string' && pfp && isCloudinaryUrl(pfp);
        });

        // 3) Optional client-side search on title/slug before hydrating
        const preSearched = query
          ? filteredByPFP.filter(p => {
              const t = (p.title?.rendered || p.title || '').toString().toLowerCase();
              const s = (p.slug || '').toString().toLowerCase();
              const q = query.toLowerCase();
              return t.includes(q) || s.includes(q);
            })
          : filteredByPFP;

        // 4) Hydrate each page with company-page data (logos)
        //    Limit concurrency a bit to avoid hammering WP
        const concurrency = 6;
        const results = [];
        let index = 0;

        async function worker() {
          while (index < preSearched.length) {
            const i = index++;
            const p = preSearched[i];
            try {
              const compRes = await fetch(
                `${wpUrl}/wp-json/mini-sites/v1/company-page?slug=${encodeURIComponent(p.slug)}`
              );
              const comp = await compRes.json();
              if (!compRes.ok) throw new Error(comp?.message || 'company fetch failed');

              const darkerUrl = comp?.acf?.logo_darker?.url || '';
              if (!darkerUrl || !isCloudinaryUrl(darkerUrl)) {
                // Skip if no usable darker logo
                continue;
              }

              results.push({
                id: p.id,
                slug: p.slug,
                title: (p.title?.rendered || p.title || '').toString().replace(/<[^>]+>/g, ''),
                // show card thumb using profile picture first
                cardThumb: p?.acf?.profile_picture_id,
                // company logos
                darkerUrl,
                lighterUrl: comp?.acf?.logo_lighter?.url || '',
                backLighterUrl: comp?.acf?.back_lighter?.url || '',
                backDarkerUrl: comp?.acf?.back_darker?.url || '',
                // IDs
                darkerId: getPublicIdFromCloudinaryUrl(darkerUrl),
                lighterId: comp?.acf?.logo_lighter?.url
                  ? getPublicIdFromCloudinaryUrl(comp.acf.logo_lighter.url)
                  : '',
                backLighterId: comp?.acf?.back_lighter?.url
                  ? getPublicIdFromCloudinaryUrl(comp.acf.back_lighter.url)
                  : '',
                backDarkerId: comp?.acf?.back_darker?.url
                  ? getPublicIdFromCloudinaryUrl(comp.acf.back_darker.url)
                  : '',
              });
            } catch (e) {
              // ignore single item failures; continue
              // console.warn('Company fetch failed for slug', p.slug, e);
            }
          }
        }

        const workers = Array.from({ length: Math.min(concurrency, preSearched.length) }, worker);
        await Promise.all(workers);

        // 5) WordPress returns [] when no more
        const more = Array.isArray(raw) && raw.length > 0;

        // Cache hydrated batch
        pageCache.set(key, { items: results, hasMore: more });

        if (reset) setItems(results);
        else setItems(prev => [...prev, ...results]);

        setHasMore(more);
        setPage(pageNum);
      } catch (e) {
        setError(e.message || 'Unknown error');
        if (reset) setItems([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        busyRef.current = false;
      }
    },
    [wpUrl, query]
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    pageCache.clear();
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
    fetchBatch(1, true, true).finally(() => setRefreshing(false));
  }, [fetchBatch]);

  // Initial load + when opening or query changes
  useEffect(() => {
    if (!open) return;
    setItems([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setLoading(false);
    setLoadingMore(false);
    fetchBatch(1, true);
  }, [open, query, fetchBatch]);

  // Infinite scroll
  const lastElRef = useCallback(
    node => {
      if (loading || loadingMore || !hasMore) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        entries => {
          if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
            fetchBatch(page + 1, false);
          }
        },
        { threshold: 0.5, rootMargin: '20px' }
      );

      if (node) observer.current.observe(node);
    },
    [loading, loadingMore, hasMore, page, fetchBatch]
  );

  useEffect(() => () => observer.current?.disconnect(), []);

  return (
    <div
      className={`fixed top-0 left-0 h-screen w-[300px] bg-white shadow-lg z-50 border-r transform transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Choose Logo (by Page)</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={18} className={`${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="cursor-pointer">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="p-4">
        <Input
          placeholder="Filter by title or slug"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="px-4 space-y-2 overflow-y-auto h-[calc(100vh-150px)]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading pages…</span>
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">Error: {error}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No pages found (with Cloudinary profile & logo).</div>
        ) : (
          <>
            {items.map((it, idx) => (
              <div
                key={it.id}
                ref={idx === items.length - 1 ? lastElRef : null}
                className="cursor-pointer border rounded hover:bg-muted transition"
                onClick={() => {
                  // Return only the darker public ID (current app expects a single ID)
                  onSelect(it.darkerId);
                  onClose();
                }}
              >
                <img
                  src={it.darkerUrl || it.cardThumb}
                  alt={`${it.title} logo`}
                  className="w-full h-auto rounded bg-gray-50"
                  loading="lazy"
                />
                <div className="px-2 py-2">
                  <div className="text-sm font-medium truncate">{it.title}</div>
                  <div className="text-[11px] text-gray-500 truncate">{it.slug}</div>
                  <div className="text-[11px] text-gray-500 truncate">Public ID: {it.darkerId}</div>
                </div>
              </div>
            ))}

            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                <span className="ml-2 text-sm text-muted-foreground">Loading more…</span>
              </div>
            )}

            {!hasMore && items.length > 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">No more pages</div>
            )}
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-50 px-4 py-2 border-t">
          <div className="text-xs text-muted-foreground text-center">Showing {items.length} pages</div>
        </div>
      )}
    </div>
  );
}
