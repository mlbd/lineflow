// src/components/EditLogoPanel.jsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

const API_ROOT = '/api/ms';
const LS_KEY = 'ms_cache_pages_all_v5';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

function isCloudinary(url = '') {
  return typeof url === 'string' && url.includes('cloudinary.com');
}

function getPublicIdFromCloudinaryUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const vIdx = parts.findIndex((p) => /^v\d+$/i.test(p));
    const after = vIdx >= 0 ? parts.slice(vIdx + 1) : parts;
    return after.map((seg) => seg.replace(/\.[a-z0-9]+$/i, '')).join('/');
  } catch {
    return '';
  }
}

export default function EditLogoPanel({
  open,
  onClose,
  onSelect,
  // wpUrl, folder  // accepted for compatibility; not used anymore
}) {
  const [list, setList] = useState([]); // full pages after filtering by logo_darker
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const filtered = q
    ? list.filter((p) => {
        const term = q.toLowerCase();
        return (
          (p.title || '').toLowerCase().includes(term) ||
          (p.slug || '').toLowerCase().includes(term) ||
          String(p.id || '').includes(term)
        );
      })
    : list;

  const load = useCallback(async () => {
    // cache-first
    const cached = lsGet(LS_KEY);
    if (cached && Array.isArray(cached.pages)) {
      setList(cached.pages);
      return;
    }

    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`${API_ROOT}/pages`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      // expected: { pages: [ { id, title, slug, acf: { logo_darker, logo_lighter, back_* } } ] }
      const pages = (Array.isArray(json?.pages) ? json.pages : []).filter((p) =>
        isCloudinary(p?.acf?.logo_darker?.url || '')
      );

      setList(pages);
      lsSet(LS_KEY, { pages });
    } catch (e) {
      setErr(e.message || 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  // respond to global "Clear Cache" button in page.jsx
  useEffect(() => {
    const onClear = () => {
      localStorage.removeItem(LS_KEY);
      setList([]);
    };
    window.addEventListener('ms-clear-cache', onClear);
    return () => window.removeEventListener('ms-clear-cache', onClear);
  }, []);

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
        <h2 className="text-lg font-semibold">Select Logo / Page</h2>
        <button onClick={onClose} className="cursor-pointer" aria-label="Close">
          <X size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="p-4">
        <Input
          placeholder="Search by title, slug, or ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
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
          filtered.map((p) => {
            const darkerUrl = p?.acf?.logo_darker?.url || '';
            const darkerId = getPublicIdFromCloudinaryUrl(darkerUrl);

            return (
              <div
                key={p.id}
                className="cursor-pointer border rounded hover:bg-muted transition"
                onClick={() => {
                  // match current page.jsx usage: onSelect(publicId, page)
                  onSelect(darkerId, p);
                  onClose();
                }}
              >
                {darkerUrl ? (
                  <img
                    src={darkerUrl}
                    alt={`${p.title} logo`}
                    className="w-full h-auto rounded bg-gray-50"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full aspect-[16/9] rounded bg-gray-100" />
                )}
                <div className="px-2 py-2">
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <div className="text-[11px] text-gray-500 truncate">{p.slug}</div>
                </div>
              </div>
            );
          })
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
