'use client';

import { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

// =================== Config / Globals ===================
const LS_KEY = 'ms_cache_pages_all_v1';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (change here)

// =================== API ===================
const API_ROOT = '/api/ms';

function getPublicIdFromCloudinaryUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const vIdx = parts.findIndex(p => /^v\d+$/i.test(p));
    const after = vIdx >= 0 ? parts.slice(vIdx + 1) : parts;
    let candidate = after[after.length - 1] || '';
    candidate = candidate.replace(/\.[a-z0-9]+$/i, '');
    return candidate;
  } catch {
    return '';
  }
}

// Helpers: localStorage with TTL
function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const json = JSON.parse(raw);
    if (!json?.__ts || !json?.__ttl) return null;
    if (Date.now() - json.__ts > json.__ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return json.data;
  } catch {
    return null;
  }
}
function lsSet(key, data, ttl = CACHE_TTL_MS) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, __ts: Date.now(), __ttl: ttl }));
  } catch {}
}

export default function EditLogoPanel({ open, onClose, onSelect }) {
  const [all, setAll] = useState([]); // [{id,title,darkerUrl,darkerId}]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const filtered = q
    ? all.filter(it => (it.title || '').toLowerCase().includes(q.toLowerCase()))
    : all;

  const load = useCallback(async () => {
    // 1) local cache first
    const cached = lsGet(LS_KEY);
    if (cached && Array.isArray(cached?.pages)) {
      setAll(cached.pages);
      return;
    }
    // 2) server cache (shared) — one call returns ALL filtered pages aggregated
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`${API_ROOT}/pages`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      const pages = Array.isArray(json?.pages)
        ? json.pages.map(p => ({
            ...p,
            darkerId: p.darkerId || getPublicIdFromCloudinaryUrl(p.darkerUrl),
          }))
        : [];
      setAll(pages);
      lsSet(LS_KEY, { pages });
    } catch (e) {
      setErr(e.message || 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  // React to Clear Cache global event
  useEffect(() => {
    const onClear = () => {
      localStorage.removeItem(LS_KEY);
      setAll([]);
    };
    window.addEventListener('ms-clear-cache', onClear);
    return () => window.removeEventListener('ms-clear-cache', onClear);
  }, []);

  // Open -> load once (cache-first)
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <div
      className={`fixed top-0 left-0 h-screen w-[300px] bg-white shadow-lg z-50 border-r transform transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Select Logo</h2>
        <button onClick={onClose} className="cursor-pointer">
          <X size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="p-4">
        <Input placeholder="Filter by title" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {/* Body */}
      <div className="px-4 space-y-2 overflow-y-auto h-[calc(100vh-150px)]">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading pages…
          </div>
        ) : err ? (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">Error: {err}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No pages found.</div>
        ) : (
          filtered.map(it => (
            <div
              key={it.id}
              className="cursor-pointer border rounded hover:bg-muted transition"
              onClick={() => {
                onSelect(it.darkerId); // keep returning public ID
                onClose();
              }}
            >
              <img
                src={it.darkerUrl}
                alt={`${it.title} logo`}
                className="w-full h-auto rounded bg-gray-50"
                loading="lazy"
              />
              <div className="px-2 py-2">
                <div className="text-sm font-medium truncate">{it.title}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-50 px-4 py-2 border-t">
          <div className="text-xs text-muted-foreground text-center">
            Showing {filtered.length} pages
          </div>
        </div>
      )}
    </div>
  );
}
