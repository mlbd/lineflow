'use client';

import { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

const API_ROOT = '/api/ms';
const LS_KEY = 'ms_cache_products_all_v2';
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

export default function EditImagePanel({ open, onClose, onSelect }) {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const filtered = q
    ? all.filter(p => {
        const term = q.toLowerCase();
        return (p.name || '').toLowerCase().includes(term) || String(p.id || '').includes(term);
      })
    : all;

  const load = useCallback(async () => {
    // cache-first (browser)
    const cached = lsGet(LS_KEY);
    if (cached && Array.isArray(cached.products)) {
      setAll(cached.products);
      return;
    }

    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`${API_ROOT}/products`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      const products = Array.isArray(json?.products) ? json.products : [];
      setAll(products);
      lsSet(LS_KEY, { products });
    } catch (e) {
      setErr(e.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  // react to global "Clear Cache"
  useEffect(() => {
    const onClear = () => {
      localStorage.removeItem(LS_KEY);
      setAll([]);
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
        <h2 className="text-lg font-semibold">Select Product</h2>
        <button onClick={onClose} className="cursor-pointer">
          <X size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="p-4">
        <Input placeholder="Search by name or ID" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {/* Body */}
      <div className="px-4 space-y-2 overflow-y-auto h-[calc(100vh-150px)]">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading products…
          </div>
        ) : err ? (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">Error: {err}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No products found.</div>
        ) : (
          filtered.map(p => {
            const img = p?.thumbnail_meta?.url || p?.thumbnail || '';
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 p-2 border rounded hover:bg-muted transition cursor-pointer"
                onClick={() => {
                  if (!img) return;
                  // Pass url, productId and full product (for placement_coordinates)
                  onSelect(img, p.id, p);
                  onClose();
                }}
              >
                {img ? (
                  <img src={img} alt={p.name} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-100" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    #{p.id} — {p.name}
                  </div>
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
            Showing {filtered.length} products
          </div>
        </div>
      )}
    </div>
  );
}
