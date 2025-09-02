// src/app/page.jsx
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Image as IconImage,
  Plus,
  Trash2,
  ArrowsUpFromLine,
  Grid3X3,
  MapPin,
  Images,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

import ImageCanvas from '@/components/ImageCanvas';
import MappingList from '@/components/MappingList';
import EditMappingModal from '@/components/EditMappingModal';
import EditImagePanel from '@/components/EditImagePanel';
import EditLogoPanel from '@/components/EditLogoPanel';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  generateProductImageUrl,
  generateProductImageUrlWithOverlay,
} from '@/utils/cloudinaryMockup';
import LogoutButton from '@/components/LogoutButton';

import { wpApiFetch } from '@/lib/wpApi';

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

function ToolButton({ icon: Icon, label, onClick, className = '', title }) {
  return (
    <button
      onClick={onClick}
      title={title || label}
      className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-[#eee] transition cursor-pointer ${className}`}
      type="button"
    >
      <Icon size={18} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// Build a minimal Cloudinary URL from a public id (no extension needed)
function cldUrlFromPublicId(publicId) {
  if (!publicId) return '';
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
}

// Simple helper for contrasting text on color dots
function isDark(hex = '') {
  const h = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const y = (r * 299 + g * 587 + b * 114) / 1000;
  return y < 128;
}

function getProductThumbUrl(p) {
  return p?.thumbnail_meta?.url || p?.thumbnail || '';
}

// --- Cloudinary helpers
function isCloudinaryUrl(url = '') {
  if (typeof url !== 'string') return false;
  return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
}

/** Parse an array or a JSON string that may contain an array; else return [] */
function parseMaybeJsonArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

// ---- Extra print price detection helpers (hoisted) ----
function coerceNonNeg(v) {
  if (v === null || typeof v === 'undefined') return NaN;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function findExtraPrintPriceInProduct(p) {
  if (!p || typeof p !== 'object') return NaN;
  const candidates = [
    p.extra_print_price,
    p?.meta?.extra_print_price,
    p?.acf?.extra_print_price,
    p?.placement_extra_print_price,
    p?.acf?.placement_extra_print_price,
  ];
  for (const c of candidates) {
    const num = coerceNonNeg(c);
    if (Number.isFinite(num)) return num;
  }
  return NaN;
}

// [PATCH] Added: derive "onlyOne" from product meta (supports "1", 1, "true", true)
function readOnlyOneFlag(val) {
  if (val === true) return true;
  if (val === 1) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  }
  return false;
}

// [PATCH] Added: scan typical locations for onlyone meta and coerce to boolean
function getOnlyOneFromProduct(p) {
  if (!p || typeof p !== 'object') return false;
  const candidates = [p.onlyone, p?.meta?.onlyone, p?.acf?.onlyone];
  for (const c of candidates) {
    // treat empty string/undefined/null as "not set"
    if (c !== undefined && c !== null && String(c).trim() !== '') {
      return readOnlyOneFlag(c);
    }
  }
  return false;
}

export default function HomePage() {
  const [imageUrl, setImageUrl] = useState(
    `https://res.cloudinary.com/${cloudName}/image/upload/V-Neck_L-Gray_ulfprv.jpg`
  );
  const [mappings, setMappings] = useState([]);
  const [selectedMapping, setSelectedMapping] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [showProductPanel, setShowProductPanel] = useState(false);
  const [showLogoPanel, setShowLogoPanel] = useState(false);

  // product + logo/page selections
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);
  const [logoId, setLogoId] = useState(''); // publicId (if we have it)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(''); // for the topbar preview
  const [companyLogos, setCompanyLogos] = useState({}); // to feed Cloudinary builders

  // placement source hint: null | { type: 'page', pageId, pageTitle, productId? }
  const [mappingSource, setMappingSource] = useState(null);

  const [hasFuturePlan, setHasFuturePlan] = useState(false);

  // Save modal (result)
  const [resultOpen, setResultOpen] = useState(false);
  const [resultOk, setResultOk] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  // Freeze overlay
  const [isSaving, setIsSaving] = useState(false);

  // Mapping popups
  const [placementMapOpen, setPlacementMapOpen] = useState(false);
  const [logosMapOpen, setLogosMapOpen] = useState(false);
  const [logosOverlayMapOpen, setLogosOverlayMapOpen] = useState(false);
  const [logosSliderIdx, setLogosSliderIdx] = useState(0);

  // dialogs
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnTitle, setWarnTitle] = useState('');
  const [warnBody, setWarnBody] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmBody, setConfirmBody] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // fn

  // keep full page object so we can validate placements later
  const [selectedPageFull, setSelectedPageFull] = useState(null);

  // Update-only-for-page checkbox
  const [onlyThisPage, setOnlyThisPage] = useState(false);

  // ========= NEW: toggle to apply Page meta placements =========
  const [usePagePlacements, setUsePagePlacements] = useState(false);
  const [pagePlacementsCandidate, setPagePlacementsCandidate] = useState([]); // normalized
  const [pagePlacementsAvailable, setPagePlacementsAvailable] = useState(false);

  // ========= NEW: Active-only previews with manual add buttons (existing feature kept) =========
  const [logosManualAreas, setLogosManualAreas] = useState(new Set()); // names added by user
  const [logosManualOn, setLogosManualOn] = useState(new Set()); // names force-added
  const [logosManualOff, setLogosManualOff] = useState(new Set()); // names force-removed
  const [logosPreviewLoading, setLogosPreviewLoading] = useState(false);

  // [PATCH] Added: deletion in-flight state
  const [isDeleting, setIsDeleting] = useState(false);

  // =========== Extra print price ===========
  // NEW: Extra print price UI state
  const [addExtraPrice, setAddExtraPrice] = useState(false);
  const [extraPrice, setExtraPrice] = useState('');

  // csrftoken
  const [csrfToken, setCsrfToken] = useState('');

  // [PATCH] Added: save/revalidate phase to control overlay messages
  const [savePhase, setSavePhase] = useState('idle'); // 'idle' | 'saving' | 'cache'

  // [PATCH] Added: state to force a single active placement at a time
  const [onlyOne, setOnlyOne] = useState(false);

  // [PATCH] Added: remember previously-active IDs to detect the newly toggled one
  const prevActiveIdsRef = useRef(new Set());

  // Reset overrides each time the modal opens
  useEffect(() => {
    if (logosMapOpen) {
      setLogosManualOn(new Set());
      setLogosManualOff(new Set());
    }
  }, [logosMapOpen]);

  // === Page-level overrides (derived from the selected page) ===
  const pagePlacementMap = useMemo(() => {
    const src = selectedPageFull?.meta?.placement_coordinates;
    if (!src) return {};
    if (typeof src === 'object' && !Array.isArray(src)) return src;
    if (typeof src === 'string') {
      try {
        const parsed = JSON.parse(src);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {}
    }
    return {};
  }, [selectedPageFull]);

  const originalActiveByName = useMemo(() => {
    const map = new Map();
    (mappings || []).forEach(m => map.set(m?.name || '', !!m?.active));
    return map;
  }, [mappings]);

  // Allow-list of product IDs that can use "back" placements on this page
  const customBackAllowedIds = useMemo(
    () => (selectedPageFull?.acf?.custom_logo_products || []).map(String),
    [selectedPageFull]
  );

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const futurePlan = urlParams.get('future_plan');
    setHasFuturePlan(futurePlan === 'true');
  }, []);

  // When the selected product object changes (e.g., after save), reflect its extra_print_price
  useEffect(() => {
    if (!selectedProduct) {
      setAddExtraPrice(false);
      setExtraPrice('');
      return;
    }
    const pre = findExtraPrintPriceInProduct(selectedProduct);
    if (!onlyThisPage && Number.isFinite(pre)) {
      setAddExtraPrice(true);
      setExtraPrice(String(pre));
    } else if (!addExtraPrice) {
      // Only reset if user didn't manually toggle it on
      setAddExtraPrice(false);
      setExtraPrice('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, onlyThisPage, findExtraPrintPriceInProduct]);

  // once per load
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch('/api/editor/csrf', { method: 'GET' });
        const j = await r.json().catch(() => ({}));
        if (active && j?.token) setCsrfToken(j.token);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = id => {
    setMappings(prev => prev.filter(m => m.id !== id));
    if (selectedMapping?.id === id) setSelectedMapping(null);
  };

  const handleEdit = id => {
    const mapping = mappings.find(m => m.id === id);
    if (mapping) {
      setSelectedMapping(mapping);
      setEditOpen(true);
    }
  };

  // NEW: parse & validate
  const extraPriceNumber = useMemo(() => {
    const n = parseFloat(String(extraPrice).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }, [extraPrice]);

  const extraPriceValid = useMemo(
    () => addExtraPrice && Number.isFinite(extraPriceNumber) && extraPriceNumber >= 0,
    [addExtraPrice, extraPriceNumber]
  );

  // NEW: compute the update button label
  const updateBtnLabel = useMemo(() => {
    let label =
      onlyThisPage && selectedPage?.title ? `Update for ${selectedPage.title}` : 'Update Placement';
    if (!onlyThisPage && extraPriceValid) label += ' +';
    return label;
  }, [onlyThisPage, selectedPage?.title, extraPriceValid]);

  // [PATCH] Added: does product have saved placements in WP?
  const productHasPlacementsInWP = useMemo(() => {
    const raw = selectedProduct?.placement_coordinates;
    let arr = Array.isArray(raw) ? raw : [];
    if (!arr.length && typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) arr = parsed;
      } catch {}
    }
    return Array.isArray(arr) && arr.length > 0;
  }, [selectedProduct]);

  // [PATCH] Added: does selected page have saved placements for this product?
  const pageHasPlacementsInWP = useMemo(() => {
    const pc = selectedPageFull?.meta?.placement_coordinates;
    const key = String(selectedProductId || '');
    const list =
      pc && typeof pc === 'object' && !Array.isArray(pc) ? parseMaybeJsonArray(pc[key]) : [];
    return Array.isArray(list) && list.length > 0;
  }, [selectedPageFull, selectedProductId]);

  // [PATCH] Added: delete button label
  const deleteBtnLabel = useMemo(() => {
    return usePagePlacements ? 'Delete placements from page' : 'Delete placements from product';
  }, [usePagePlacements]);

  // [PATCH] Added: toggle handler for "Only One"
  const handleToggleOnlyOne = checked => {
    if (!checked) {
      setOnlyOne(false);
      return;
    }

    const activeNow = Array.isArray(mappings) ? mappings.filter(m => m?.active).length : 0;
    if (activeNow > 1) {
      setWarnTitle('Cannot enable "Only One"');
      setWarnBody(
        'Multiple placements are currently active.\n\n' +
          'Please deactivate extras so only a single placement remains, then enable "Only One".'
      );
      setWarnOpen(true);
      // [PATCH] Prevent enabling the checkbox
      setOnlyOne(false);
      return;
    }

    setOnlyOne(true);
  };

  // [PATCH] Added: enforce single-active rule whenever mappings change
  useEffect(() => {
    if (!onlyOne || !Array.isArray(mappings) || mappings.length === 0) {
      // keep prevActiveIds in sync
      const ids = new Set(mappings.filter(m => m?.active).map(m => m.id));
      prevActiveIdsRef.current = ids;
      return;
    }

    const activeIds = mappings.filter(m => m?.active).map(m => m.id);
    if (activeIds.length <= 1) {
      prevActiveIdsRef.current = new Set(activeIds);
      return;
    }

    // Determine which placement was newly turned on (prefer keeping the new one)
    const prev = prevActiveIdsRef.current || new Set();
    const newlyOn = activeIds.filter(id => !prev.has(id));
    const keepId = newlyOn.length
      ? newlyOn[newlyOn.length - 1] // keep the latest newly activated
      : activeIds[activeIds.length - 1]; // fallback: keep the last active in list

    const next = mappings.map(m =>
      m?.id === keepId ? { ...m, active: true } : { ...m, active: false }
    );
    // [PATCH] Inform user and enforce the rule
    setWarnTitle('Only one placement allowed');
    setWarnBody('"Only One" is enabled, so selecting a placement turns off the others.');
    setWarnOpen(true);
    setMappings(next);
    prevActiveIdsRef.current = new Set([keepId]);
  }, [mappings, onlyOne]);

  // replace your existing handleClearAll with this:
  // [PATCH] Updated: reset "Only One" when clearing everything
  const handleClearAll = () => {
    // placements
    setMappings([]);
    setSelectedMapping(null);
    setMappingSource(null);

    // selection: product
    setSelectedProductId(null);
    setSelectedProduct(null);

    // selection: page/logo
    setSelectedPage(null);
    setSelectedPageFull?.(null);
    setCompanyLogos({});
    setLogoId('');
    setLogoPreviewUrl('');

    // UI flags
    setOnlyThisPage(false);
    setUsePagePlacements(false);
    setPagePlacementsCandidate([]);
    setPagePlacementsAvailable(false);
    setLogosSliderIdx(0);
    // [PATCH] Added: reset Only One toggle
    setOnlyOne(false);

    // close any open panels/modals
    setShowProductPanel(false);
    setShowLogoPanel(false);
    setPlacementMapOpen(false);
    setLogosMapOpen(false);
    setLogosOverlayMapOpen(false);

    try {
      localStorage.removeItem('logo_page_data');
    } catch {}

    setImageUrl(`https://res.cloudinary.com/${cloudName}/image/upload/V-Neck_L-Gray_ulfprv.jpg`);
  };

  const handleUpdateMeta = () => {
    alert('Coming Soon..');
  };

  const handleViewWithAllLogos = () => {
    if (mappings.length === 0) {
      alert('Please create at least one placement area before viewing logos.');
      return;
    }
    window.open('/logos', '_blank');
  };

  // Persist to localStorage for logos page
  useEffect(() => {
    const dataToPass = {
      imageUrl,
      mappings,
      logoId,
      selectedProductId,
    };
    localStorage.setItem('logo_page_data', JSON.stringify(dataToPass));
  }, [imageUrl, mappings, logoId, selectedProductId]);

  useEffect(() => {
    const handleKeyDown = e => {
      if ((e.key === 'Delete' || e.key === 'Del') && selectedMapping) {
        handleDelete(selectedMapping.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMapping]);

  // --- current product thumbnail URL (prefer product meta, else canvas URL)
  const currentThumbUrl = useMemo(() => {
    return (selectedProduct ? getProductThumbUrl(selectedProduct) : imageUrl) || '';
  }, [selectedProduct, imageUrl]);

  // --- Gate for Logos Mapping buttons: require Cloudinary base image
  const ensureCloudinaryForMapping = openFn => {
    if (!selectedProductId) return;
    if (!isCloudinaryUrl(currentThumbUrl)) {
      setWarnTitle('Cloudinary image required');
      setWarnBody(
        `The selected product's thumbnail is not a Cloudinary URL, so we can't resolve a public ID for logo mapping.\n\n` +
          `• Product: #${selectedProductId}${selectedProduct?.name ? ` — ${selectedProduct.name}` : ''}\n` +
          `• Current URL: ${currentThumbUrl || '(empty)'}\n\n` +
          `Please choose a product whose thumbnail comes from Cloudinary (e.g. contains "res.cloudinary.com").`
      );
      setWarnOpen(true);
      return;
    }
    openFn(true);
  };

  // Client-side helper: clear ONE product from the Next.js server cache
  const clearProductCacheClient = useCallback(
    async (id, { prime = false } = {}) => {
      if (!id) return;
      if (!csrfToken) {
        console.warn('[cache] skip: no csrfToken yet');
        return;
      }
      console.log(`[cache] Clearing product #${id} from cache...`, csrfToken);
      try {
        const url = `/api/cache/product/clear?id=${id}${prime ? '&prime=1' : ''}`;
        const r = await fetch(`/api/cache/product/clear${prime ? '?prime=1' : ''}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ms-csrf': csrfToken,
          },
          body: JSON.stringify({ id }),
        });

        const txt = await r.text();
        const msg = `[cache] POST ${url} -> ${r.status}`;
        if (!r.ok) console.warn(msg, txt);
        else console.log(msg, txt);
      } catch (e) {
        console.warn('Product cache clear error', e);
      }
    },
    [csrfToken]
  );

  // [PATCH] Added: clear page cache by slug via /api/revalidate
  const revalidatePageBySlug = useCallback(
    async slug => {
      if (!slug) return;
      if (!csrfToken) {
        console.warn('[cache] skip page revalidate: no csrfToken yet');
        return;
      }
      try {
        const url = `/api/revalidate?slug=${encodeURIComponent(slug)}`;
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ms-csrf': csrfToken,
          },
          body: JSON.stringify({}),
        });
        const txt = await r.text();
        const msg = `[cache] POST ${url} -> ${r.status}`;
        if (!r.ok) console.warn(msg, txt);
        else console.log(msg, txt);
      } catch (e) {
        console.warn('Page revalidate error', e);
      }
    },
    [csrfToken]
  );

  // === Update Placement (with guard for active) ===
  const handleSavePlacement = async () => {
    if (!selectedProductId || mappings.length === 0) return;

    const hasActive = Array.isArray(mappings) && mappings.some(m => m?.active === true);
    if (!hasActive) {
      setWarnTitle('No active placements');
      setWarnBody(
        'You must mark at least one placement as Active before saving.\n\n' +
          'Open a placement, toggle "Active", and try again.'
      );
      setWarnOpen(true);
      return;
    }

    if (!isCloudinaryUrl(currentThumbUrl)) {
      setConfirmTitle('Proceed without Cloudinary image?');
      setConfirmBody(
        `This product's thumbnail is not a Cloudinary URL. Saving placements will still update the product meta, ` +
          `but logo previews/overlays that depend on a Cloudinary public ID may fail.\n\n` +
          `• Product: #${selectedProductId}${selectedProduct?.name ? ` — ${selectedProduct.name}` : ''}\n` +
          `• Current URL: ${currentThumbUrl || '(empty)'}\n\n` +
          `Do you want to continue?`
      );
      setConfirmAction(() => doSavePlacement);
      setConfirmOpen(true);
      return;
    }

    await doSavePlacement();
  };

  const doSavePlacement = async () => {
    setConfirmOpen(false);
    setIsSaving(true);
    // [PATCH] Added: begin "saving" phase (controls overlay text)
    setSavePhase('saving');

    setResultMsg('');
    setResultOk(false);
    setResultOpen(false);

    try {
      const res = await wpApiFetch(`update-placement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProductId,
          placements: mappings,
          ...(onlyThisPage && selectedPage?.id ? { page_id: selectedPage.id } : {}),
          // NEW: only send when not page-scoped, box is checked, and value is valid
          ...(!onlyThisPage && extraPriceValid ? { extra_print_price: extraPriceNumber } : {}),
          onlyOne: Boolean(onlyOne),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      // --- keep your existing local cache updates (no change in behavior) ---
      try {
        if (data?.saved_on === 'product' && data?.product) {
          if (Number(data.product.id) === Number(selectedProductId)) {
            setSelectedProduct(data.product);
          }
          const LS_KEY = 'ms_cache_products_all_v2';
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.data?.products)) {
              parsed.data.products = parsed.data.products.map(p =>
                p.id === data.product.id ? data.product : p
              );
              parsed.__ts = Date.now();
              localStorage.setItem(LS_KEY, JSON.stringify(parsed));
            }
          }
          // (Product cache clear will be awaited below in the "cache" phase)
        } else if (data?.saved_on === 'page' && data?.page) {
          const LS_KEY_PAGES = 'ms_cache_pages_all_v5';
          const raw = localStorage.getItem(LS_KEY_PAGES);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.data?.pages)) {
              parsed.data.pages = parsed.data.pages.map(pg =>
                pg.id === data.page.id ? data.page : pg
              );
              parsed.__ts = Date.now();
              localStorage.setItem(LS_KEY_PAGES, JSON.stringify(parsed));
            }
          }

          // [PATCH] keep: enable "Use page placements" switch after page-scoped save
          try {
            const pc = data.page?.meta?.placement_coordinates || {};
            const key = String(selectedProductId);
            const candidate =
              pc && typeof pc === 'object' && !Array.isArray(pc)
                ? parseMaybeJsonArray(pc[key])
                : [];
            const baseW = Number(selectedProduct?.thumbnail_meta?.width) || 0;
            const baseH = Number(selectedProduct?.thumbnail_meta?.height) || 0;
            const normalized = normalizeCoords(candidate, baseW, baseH);
            setPagePlacementsCandidate(normalized);
            setPagePlacementsAvailable(normalized.length > 0);
          } catch {}
        }
      } catch (err) {
        console.error('Failed to update local cache after placement save', err);
      }

      // Success state for modal (we'll open it after cache step finishes)
      setResultOk(true);
      setResultMsg(data?.message || 'Placements saved!');
      setOnlyThisPage(false);

      // [PATCH] Begin "cache" phase: keep overlay up and update messages
      setSavePhase('cache');

      // [PATCH] Await server cache clears/revalidation BEFORE showing Result Modal
      try {
        if (data?.saved_on === 'product' && data?.product?.id) {
          await clearProductCacheClient(data.product.id, { prime: true });
        } else if (data?.saved_on === 'page') {
          // prefer selectedPage slug; fallback to returned page.slug if present
          const slug = selectedPage?.slug || data?.page?.slug;
          if (slug) {
            await revalidatePageBySlug(slug);
          }
        }
      } catch (e) {
        // Non-fatal: log and continue to show the success modal anyway
        console.warn('Revalidation step had an error:', e);
      }

      // [PATCH] Now close the overlay and show the result
      setIsSaving(false);
      setSavePhase('idle');
      setResultOpen(true);
    } catch (err) {
      setResultOk(false);
      setResultMsg(err.message || 'Failed to update placements.');

      // [PATCH] On failure: close overlay immediately and show modal (no cache step)
      setIsSaving(false);
      setSavePhase('idle');
      setResultOpen(true);
    }
  };

  // [PATCH] Added: ask for confirmation then delete from WP
  const handleConfirmDelete = () => {
    if (!selectedProductId) return;
    const isPage = usePagePlacements && selectedPage?.id;
    const noun = isPage
      ? `page "${selectedPage?.title}" (#${selectedPage?.id})`
      : `product #${selectedProductId}`;
    setConfirmTitle('Delete saved placements?');
    setConfirmBody(
      `This will remove saved placements for ${noun} in WordPress.\nThis action cannot be undone.`
    );
    setConfirmAction(() => doDeletePlacement);
    setConfirmOpen(true);
  };

  // [PATCH] Added: perform deletion via new REST API
  // [PATCH] Updated doDeletePlacement to re-enable delete button immediately on page delete
  const doDeletePlacement = async () => {
    setIsDeleting(true);
    setResultOpen(false);
    setResultOk(false);
    setResultMsg('');
    try {
      const payload = { product_id: selectedProductId };
      if (usePagePlacements && selectedPage?.id) payload.page_id = selectedPage.id;

      const res = await wpApiFetch(`delete-placement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      if (data?.deleted_on === 'product' && data?.product) {
        // Update product + local product cache
        setSelectedProduct(data.product);
        setMappings([]); // clear canvas since product placements are gone
        setSelectedMapping(null);

        try {
          const LS_KEY = 'ms_cache_products_all_v2';
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.data?.products)) {
              parsed.data.products = parsed.data.products.map(p =>
                p.id === data.product.id ? data.product : p
              );
              parsed.__ts = Date.now();
              localStorage.setItem(LS_KEY, JSON.stringify(parsed));
            }
          }
        } catch {}

        if (data?.product?.id) {
          clearProductCacheClient(data.product.id, { prime: true });
        }

        // [PATCH] Re-enable delete button ASAP after successful product delete
        setIsDeleting(false);
      } else if (data?.deleted_on === 'page' && data?.page) {
        // Update page + recompute candidate & availability for switch
        setSelectedPageFull(data.page);

        const pc = data?.page?.meta?.placement_coordinates || {};
        const key = String(selectedProductId);
        const candidate =
          pc && typeof pc === 'object' && !Array.isArray(pc) ? parseMaybeJsonArray(pc[key]) : [];
        const baseW = Number(selectedProduct?.thumbnail_meta?.width) || 0;
        const baseH = Number(selectedProduct?.thumbnail_meta?.height) || 0;
        const normalized = normalizeCoords(candidate, baseW, baseH);
        const available = normalized.length > 0;

        setPagePlacementsCandidate(normalized);
        setPagePlacementsAvailable(available);

        // [PATCH] Always revert to product context after a page delete
        const prodNorm = getNormalizedProductPlacements();
        setUsePagePlacements(false); // switch label/logic to product
        setMappingSource(null);
        setMappings(prodNorm);
        setSelectedMapping(prodNorm[0] || null);

        // Update local pages cache
        try {
          const LS_KEY_PAGES = 'ms_cache_pages_all_v5';
          const raw = localStorage.getItem(LS_KEY_PAGES);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.data?.pages)) {
              parsed.data.pages = parsed.data.pages.map(pg =>
                pg.id === data.page.id ? data.page : pg
              );
              parsed.__ts = Date.now();
              localStorage.setItem(LS_KEY_PAGES, JSON.stringify(parsed));
            }
          }
        } catch {}

        // [PATCH] Re-enable delete button immediately after page delete
        setIsDeleting(false);
      }

      // [PATCH] Begin "cache" phase messages (optional overlay)
      setSavePhase('cache');

      // [PATCH] Use deleted_on for cache/revalidate routing
      try {
        if (data?.deleted_on === 'product' && data?.product?.id) {
          await clearProductCacheClient(data.product.id, { prime: true });
        } else if (data?.deleted_on === 'page') {
          const slug = selectedPage?.slug || data?.page?.slug;
          if (slug) {
            await revalidatePageBySlug(slug);
          }
        }
      } catch (e) {
        console.warn('Revalidation step had an error:', e);
      }

      setIsSaving(false);
      setResultOk(true);
      setSavePhase('idle');
      setResultOpen(true);
    } catch (err) {
      setResultOk(false);
      setResultMsg(err.message || 'Failed to delete placements.');
    } finally {
      // [PATCH] Safety: ensure deleting flag is off even on error
      setIsDeleting(false);
      setResultOpen(true);
    }
  };

  // Normalize coords + DEFAULT active=false unless explicitly true
  const normalizeCoords = (coords, baseW = 0, baseH = 0) => {
    if (!Array.isArray(coords)) return [];
    return coords.map((c, idx) => {
      const xP = c.xPercent != null ? c.xPercent : baseW ? (c.x || 0) / baseW : 0;
      const yP = c.yPercent != null ? c.yPercent : baseH ? (c.y || 0) / baseH : 0;
      const wP = c.wPercent != null ? c.wPercent : baseW ? (c.w || 0) / baseW : 0;
      const hP = c.hPercent != null ? c.hPercent : baseH ? (c.h || 0) / baseH : 0;
      return {
        id: c.id || Date.now() + idx,
        name: c.name || `area_${idx + 1}`,
        xPercent: xP,
        yPercent: yP,
        wPercent: wP,
        hPercent: hP,
        active: c.active === true, // default off unless explicitly true
        ...c,
      };
    });
  };

  /** Helper: normalize current product's placements */
  const getNormalizedProductPlacements = useCallback(() => {
    const raw = selectedProduct?.placement_coordinates;
    let coords = Array.isArray(raw) ? raw : [];
    if (!coords.length && typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) coords = parsed;
      } catch {}
    }
    const baseW = Number(selectedProduct?.thumbnail_meta?.width) || 0;
    const baseH = Number(selectedProduct?.thumbnail_meta?.height) || 0;
    return normalizeCoords(coords, baseW, baseH);
  }, [selectedProduct]);

  /** Compute page->product candidate placements + availability */
  const computePageCandidate = useCallback(() => {
    if (!selectedPageFull || !selectedProductId) {
      return { list: [], available: false };
    }

    const pagePC = selectedPageFull?.meta?.placement_coordinates;
    const key = String(selectedProductId);

    // Strict requirement: pagePC must be an object keyed by product id and contain a non-empty array
    if (pagePC && typeof pagePC === 'object' && !Array.isArray(pagePC)) {
      const chosen = parseMaybeJsonArray(pagePC[key]);
      if (Array.isArray(chosen) && chosen.length) {
        const baseW = Number(selectedProduct?.thumbnail_meta?.width) || 0;
        const baseH = Number(selectedProduct?.thumbnail_meta?.height) || 0;
        return { list: normalizeCoords(chosen, baseW, baseH), available: true };
      }
      return { list: [], available: false };
    }

    // No keyed entries => not available (legacy arrays intentionally ignored per new requirement)
    return { list: [], available: false };
  }, [selectedPageFull, selectedProductId, selectedProduct]);

  // [PATCH] Updated: do NOT auto-turn OFF when page has no saved placements.
  // Keep switch ON; keep current mappings/selection. If page later gains placements,
  // we can optionally sync them to canvas.
  useEffect(() => {
    const { list, available } = computePageCandidate();
    setPagePlacementsCandidate(list);
    setPagePlacementsAvailable(available);

    // [PATCH] Optional: if switch is ON and placements become available (e.g. just saved),
    // you may auto-apply them. If you prefer manual apply only, remove this block.
    if (usePagePlacements && available && list.length > 0) {
      setMappings(list);
      setSelectedMapping(list[0] || null);
      setMappingSource({
        type: 'page',
        pageId: selectedPage?.id,
        pageTitle: selectedPage?.title,
        productId: selectedProductId,
      });
    }

    // [PATCH] Removed the old branch that forcibly setUsePagePlacements(false) on !available.
  }, [
    computePageCandidate,
    usePagePlacements,
    getNormalizedProductPlacements,
    selectedPage?.id,
    selectedPage?.title,
    selectedProductId,
  ]);

  /** [PATCH] Toggle handler now scopes updates to the selected page, validates guards,
   * applies page placements only if they exist, and keeps button labels in sync. */
  const handleToggleUsePagePlacements = nextOn => {
    if (nextOn) {
      // Guard 1: product must be selected
      if (!selectedProductId) {
        setWarnTitle('Select a product first');
        setWarnBody('You need to select a product before scoping updates to a page.');
        setWarnOpen(true);
        setUsePagePlacements(false);
        setOnlyThisPage(false);
        return;
      }

      // Guard 2: product must be allowed on this page
      const allowed = Array.isArray(selectedPageFull?.acf?.selected_products)
        ? selectedPageFull.acf.selected_products
        : null;
      if (!allowed) {
        setWarnTitle('This page cannot be scoped');
        setWarnBody(
          `The selected page (#${selectedPage?.id} — ${selectedPage?.title}) has no selected_products list.\n` +
            `You cannot restrict updates to this page.`
        );
        setWarnOpen(true);
        setUsePagePlacements(false);
        setOnlyThisPage(false);
        return;
      }
      const ok = allowed.some(p => Number(p?.id) === Number(selectedProductId));
      if (!ok) {
        setWarnTitle('Product not allowed for this page');
        setWarnBody(
          `Product #${selectedProductId}${selectedProduct?.name ? ` — ${selectedProduct.name}` : ''} is not in\n` +
            `the page's allowed products.\n\nPage: #${selectedPage?.id} — ${selectedPage?.title}`
        );
        setWarnOpen(true);
        setUsePagePlacements(false);
        setOnlyThisPage(false);
        return;
      }

      console.log(
        'pagePlacementsAvailable',
        pagePlacementsAvailable,
        'pagePlacementsCandidate',
        pagePlacementsCandidate
      );
      // If the page ALREADY has saved placements for this product, apply them to canvas
      if (pagePlacementsAvailable && pagePlacementsCandidate.length > 0) {
        setMappings(pagePlacementsCandidate);
        setSelectedMapping(pagePlacementsCandidate[0] || null);
        setMappingSource({
          type: 'page',
          pageId: selectedPage?.id,
          pageTitle: selectedPage?.title,
          productId: selectedProductId,
        });
      } else {
        // No saved page placements: keep current mappings; buttons will be disabled by guards
        setWarnTitle('No saved page placements');
        setWarnBody(
          `This page does not have saved placements for the selected product.\n\n` +
            `So, you can use the current placements, or draw a new placement and save with "Update for ${selectedPage?.title}", or switch this off.`
        );
        setMappingSource({
          type: 'page',
          pageId: selectedPage?.id,
          pageTitle: selectedPage?.title,
          productId: selectedProductId,
        });
        setWarnOpen(true);
      }

      console.log('===============================hello=====================');

      // Page-scope ON -> update labels via onlyThisPage
      setUsePagePlacements(true);
      setOnlyThisPage(true);
      // When scoping to page, extra price UI should be hidden/cleared
      setAddExtraPrice(false);
      setExtraPrice('');
      return;
    }

    // OFF => revert to product placements and clear page-scope (labels revert too)
    const prodNorm = getNormalizedProductPlacements();
    setUsePagePlacements(false);
    setOnlyThisPage(false);
    setMappingSource(null);
    setMappings(prodNorm);
    setSelectedMapping(prodNorm[0] || null);
  };

  /** Remove selected logo/page completely */
  const handleRemoveSelectedLogoPage = () => {
    // If we were using page placements, revert first
    if (usePagePlacements) {
      const prodNorm = getNormalizedProductPlacements();
      setUsePagePlacements(false);
      setMappingSource(null);
      setMappings(prodNorm);
      setSelectedMapping(prodNorm[0] || null);
    }

    setSelectedPage(null);
    setSelectedPageFull(null);
    setCompanyLogos({});
    setLogoId('');
    setLogoPreviewUrl('');
    setOnlyThisPage(false);
    setPagePlacementsCandidate([]);
    setPagePlacementsAvailable(false);
  };

  // Use the live rectangles drawn on the canvas for previews (raw)
  const previewProduct = useMemo(() => {
    if (!selectedProduct) return null;
    return {
      ...selectedProduct,
      placement_coordinates: Array.isArray(mappings) ? mappings : [],
    };
  }, [selectedProduct, mappings]);

  useEffect(() => {
    // Drop stale names if mapping list changed
    setLogosManualAreas(prev => {
      const next = new Set();
      mappings.forEach(m => {
        if (prev.has(m.name)) next.add(m.name);
      });
      return next;
    });
  }, [mappings]);

  // effective list: active === true OR clicked by user
  const effectiveMappingsForPreview = useMemo(() => {
    if (!Array.isArray(mappings)) return [];
    return mappings.filter(m => m?.active === true || (m?.name && logosManualAreas.has(m.name)));
  }, [mappings, logosManualAreas]);

  // product clone that uses only the effective placements
  const previewProductActive = useMemo(() => {
    if (!selectedProduct) return null;
    return { ...selectedProduct, placement_coordinates: effectiveMappingsForPreview };
  }, [selectedProduct, effectiveMappingsForPreview]);

  const previewPlacements = useMemo(() => {
    return (mappings || []).map(m => {
      const nm = m?.name || '';
      const isAdded = logosManualOn.has(nm);
      const isRemoved = logosManualOff.has(nm);
      return { ...m, active: isAdded ? true : isRemoved ? false : !!m?.active };
    });
  }, [mappings, logosManualOn, logosManualOff]);

  const previewProductForLogos = useMemo(() => {
    if (!selectedProduct) return null;
    return { ...selectedProduct, placement_coordinates: previewPlacements };
  }, [selectedProduct, previewPlacements]);

  // Main logos preview (no overlay)
  const logosSliderImages = useMemo(() => {
    const p = previewProductForLogos;
    const logos = companyLogos && Object.keys(companyLogos).length ? companyLogos : null;
    if (!p || !logos) return [];

    const isGroup = p?.acf?.group_type === 'Group';
    const colors = isGroup && Array.isArray(p?.acf?.color) ? p.acf.color : [];

    if (!colors.length) {
      return [
        {
          src: generateProductImageUrl(p, logos, { max: 1400, customBackAllowedIds }),
          title: p?.name || 'Preview',
          color_hex_code: p?.thumbnail_meta?.thumbnail_color || '#ffffff',
        },
      ];
    }

    return colors.map((c, i) => ({
      src: generateProductImageUrl(p, logos, { colorIndex: i, max: 1400, customBackAllowedIds }),
      title: c?.title || `Color ${i + 1}`,
      color_hex_code: c?.color_hex_code || '#ffffff',
    }));
  }, [previewProductForLogos, companyLogos, customBackAllowedIds]);

  // Overlay preview
  const logosSliderImagesOverlay = useMemo(() => {
    const p = previewProductForLogos;
    const logos = companyLogos && Object.keys(companyLogos).length ? companyLogos : null;
    if (!p || !logos) return [];

    const isGroup = p?.acf?.group_type === 'Group';
    const colors = isGroup && Array.isArray(p?.acf?.color) ? p.acf.color : [];

    const baseOpts = { max: 1400, overlayHex: '#000000', overlayOpacity: 20 };

    if (!colors.length) {
      return [
        {
          src: generateProductImageUrlWithOverlay(p, companyLogos, {
            ...baseOpts,
            customBackAllowedIds,
          }),
          title: p?.name || 'Preview',
          color_hex_code: p?.thumbnail_meta?.thumbnail_color || '#ffffff',
        },
      ];
    }

    return colors.map((c, i) => ({
      src: generateProductImageUrlWithOverlay(p, companyLogos, {
        ...baseOpts,
        colorIndex: i,
        customBackAllowedIds,
      }),
      title: c?.title || `Color ${i + 1}`,
      color_hex_code: c?.color_hex_code || '#ffffff',
    }));
  }, [previewProductForLogos, companyLogos, customBackAllowedIds]);

  // Preload current logos preview image to show overlay while regenerating
  useEffect(() => {
    if (!logosMapOpen) return;
    const url = logosSliderImages[logosSliderIdx]?.src || '';
    if (!url) {
      setLogosPreviewLoading(false);
      return;
    }
    setLogosPreviewLoading(true);
    const img = new Image();
    img.onload = () => setLogosPreviewLoading(false);
    img.onerror = () => setLogosPreviewLoading(false);
    img.src = url;
  }, [logosMapOpen, logosSliderImages, logosSliderIdx]);

  const updateButtonDisabled = isSaving || !selectedProductId || mappings.length === 0;
  const canUpdate = !!selectedProductId && mappings.length > 0 && !isSaving;

  // disable update button
  const updateButtonDisabledPatched = isSaving || !selectedProductId || mappings.length === 0;

  return (
    <main className="w-full flex justify-center bg-muted min-h-screen relative">
      {/* Freeze overlay while saving */}
      {isSaving && (
        <div className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[1px] pointer-events-auto flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-5 shadow-lg flex items-center gap-3">
            <div className="w-6 h-6 mt-0.5 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            <div className="text-sm text-gray-700 space-y-0.5">
              {/* [PATCH] Updated: two-phase overlay messages */}
              {savePhase === 'saving' && <div>Updating placement… please wait</div>}
              {savePhase === 'cache' && (
                <>
                  <div>Placement update completed.</div>
                  <div>Updating cache... please wait.</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scrim behind side panels */}
      {(showProductPanel || showLogoPanel) && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => {
            setShowProductPanel(false);
            setShowLogoPanel(false);
          }}
          aria-hidden="true"
        />
      )}

      <div className="w-full max-w-[1920px] flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="w-[300px] bg-white border-r overflow-y-auto space-y-6">
          <h1 className="relative text-md bg-primary text-white font-bold border-b border-b-[#e6e8ea] h-[55px] flex items-center justify-center">
            Placement Editor
            <span className="absolute top-3 right-3">
              <LogoutButton />
            </span>
          </h1>

          <MappingList
            mappings={mappings}
            selectedId={selectedMapping?.id}
            onSelect={id => {
              const mapping = mappings.find(m => m.id === id);
              if (mapping) setSelectedMapping(mapping);
            }}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />

          {/* Source notice (when placements are from PAGE meta) */}
          {mappingSource?.type === 'page' && (
            <div className="px-6">
              {/* [PATCH] Added: show simple message when page has no saved placements */}
              {pagePlacementsAvailable && pagePlacementsCandidate?.length > 0 ? (
                // [PATCH] Unchanged: original detailed banner when placements are loaded from the page
                <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-800">
                  <Info className="mt-0.5 h-4 w-4" />
                  <div className="text-xs leading-5">
                    Placements are loaded from <b>page</b> meta:&nbsp;
                    <b>
                      #{mappingSource.pageId} — {mappingSource.pageTitle}
                    </b>
                    <br />
                    (not from product meta:&nbsp;
                    <b>
                      #{selectedProductId} — {selectedProduct?.name || 'Product'}
                    </b>
                    )
                  </div>
                </div>
              ) : (
                // [PATCH] Added: simple notice when nothing was loaded from the page
                <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-800">
                  <Info className="mt-0.5 h-4 w-4" />
                  <div className="text-xs leading-5">no placement load from page</div>
                </div>
              )}
            </div>
          )}

          {/* NEW: Use page placements switcher (visible when a page is selected) */}
          {selectedPage?.id && (
            <div className="px-6">
              <div className="flex items-center justify-between border rounded-md p-3 bg-gray-50">
                <div className="text-sm">
                  <div className="font-medium">Use placements from this Page</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {pagePlacementsAvailable
                      ? 'Toggle on to replace product placements with saved page placements.'
                      : 'No saved placements on this page for the selected product. You can still scope updates to this page.'}
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 select-none">
                  {/* SR-only input for accessibility; label makes the whole control clickable */}
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label="Use page placements"
                    aria-checked={usePagePlacements}
                    checked={usePagePlacements}
                    onChange={e => handleToggleUsePagePlacements(e.target.checked)}
                    className="sr-only"
                  />

                  {/* Track (clips the thumb) */}
                  <span
                    className={`relative inline-block h-6 w-11 rounded-full overflow-hidden transition-colors duration-200
                      ${usePagePlacements ? 'bg-blue-600' : 'bg-gray-300'} cursor-pointer hover:bg-opacity-90
                      focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2
                    `}
                  >
                    {/* Thumb moves via left/right swap (no transforms) */}
                    <span
                      aria-hidden="true"
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-all duration-200
        ${usePagePlacements ? 'right-0.5 left-auto' : 'left-0.5 right-auto'}
      `}
                    />
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Add extra print price (hidden if scoped to a single page) */}
          {!updateButtonDisabled && !onlyThisPage && (
            <div className="flex flex-col items-center justify-center mt-3">
              <label className="flex items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 cursor-pointer"
                  checked={addExtraPrice}
                  onChange={e => setAddExtraPrice(e.target.checked)}
                />
                <span>Add extra print price</span>
              </label>

              {/* Slide toggle effect */}
              <div
                className={`transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden ${
                  addExtraPrice ? 'max-h-24 opacity-100 mt-2' : 'max-h-0 opacity-0'
                }`}
                aria-hidden={!addExtraPrice}
              >
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  placeholder="Enter amount (e.g., 5.00)"
                  className="w-full px-3 py-2 border rounded"
                  value={extraPrice}
                  onKeyDown={e => {
                    // prevent minus/exponent chars in number input
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+')
                      e.preventDefault();
                  }}
                  onChange={e => {
                    let v = e.target.value ?? '';
                    if (v.startsWith('-')) v = v.replace('-', '');
                    setExtraPrice(v);
                  }}
                />
                {!Number.isFinite(extraPriceNumber) && addExtraPrice && (
                  <div className="text-xs text-red-600 mt-1">Enter a non-negative number.</div>
                )}
              </div>
            </div>
          )}

          {/* [PATCH] Added: Only One toggle */}
          {!updateButtonDisabledPatched && (
            <div className="flex flex-col items-center justify-center mt-1 mb-1">
              <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Only One active placement"
                  className="w-4 h-4 cursor-pointer"
                  checked={onlyOne}
                  onChange={e => handleToggleOnlyOne(e.target.checked)}
                />
                <span>Only One</span>
              </label>
            </div>
          )}

          <div className="px-6 flex flex-col gap-2">
            {/* Update Placement */}
            <div>
              <button
                className={`mt-2 w-full py-2 cursor-pointer rounded font-semibold transition
                  ${updateButtonDisabledPatched ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                onClick={handleSavePlacement}
                disabled={updateButtonDisabledPatched}
              >
                {updateBtnLabel}
              </button>
            </div>

            {/* [PATCH] Added: Delete Placement from WP */}
            <div>
              <button
                className={`mt-2 w-full py-2 cursor-pointer text-sm rounded font-semibold transition
      ${
        isDeleting ||
        !selectedProductId ||
        (usePagePlacements ? !pageHasPlacementsInWP : !productHasPlacementsInWP)
          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
          : 'bg-red-600 text-white hover:bg-red-700'
      }`}
                onClick={handleConfirmDelete}
                disabled={
                  isDeleting ||
                  !selectedProductId ||
                  (usePagePlacements ? !pageHasPlacementsInWP : !productHasPlacementsInWP)
                }
              >
                {isDeleting ? 'Deleting…' : deleteBtnLabel}
              </button>
            </div>
          </div>

          <div className="flex align-center justify-center gap-4 pb-4">
            {/* Placement Mapping */}
            <button
              type="button"
              title="Placement Mapping"
              aria-label="Placement Mapping"
              onClick={() => setPlacementMapOpen(true)}
              disabled={!canUpdate}
              className={`p-2 rounded-lg border transition cursor-pointer 
                ${!canUpdate ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-primary text-white hover:bg-blue-600'}
              `}
            >
              <MapPin size={24} />
            </button>

            {/* Logos Mapping */}
            <button
              type="button"
              title="Logos Mapping"
              aria-label="Logos Mapping"
              onClick={() => ensureCloudinaryForMapping(setLogosMapOpen)}
              disabled={!canUpdate}
              className={`p-2 rounded-lg border transition cursor-pointer
                ${!canUpdate ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ' bg-primary text-white hover:bg-blue-600'}
              `}
            >
              <Images size={24} />
            </button>

            {/* Logos Mapping (with overlay) */}
            <button
              type="button"
              title="Logos Mapping (with overlay)"
              aria-label="Logos Mapping (with overlay)"
              onClick={() => ensureCloudinaryForMapping(setLogosOverlayMapOpen)}
              disabled={!canUpdate}
              className={`p-2 rounded-lg border transition cursor-pointer
                ${!canUpdate ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ' bg-primary text-white hover:bg-blue-600'}
              `}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 2l9 5-9 5-9-5 9-5zm0 7l9 5-3 1.667-6-3.333-6 3.333L3 14l9-5zm0 7l6 3.333L12 22 6 19.333 12 16z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main (Topbar + Canvas) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* === TOPBAR WITH SELECTION SUMMARIES === */}
          <div
            id="toolbarHeader"
            className="h-[55px] bg-white border-b flex items-center px-4 sm:px-6 gap-3 sm:gap-4 text-sm"
          >
            <ToolButton
              icon={IconImage}
              label="Select Product"
              title="Select Product"
              onClick={e => {
                e.stopPropagation();
                setSelectedMapping(null);
                setShowLogoPanel(false);
                setShowProductPanel(true);
              }}
            />

            <ToolButton
              icon={Plus}
              label="Select Logo"
              title="Select Logo / Page"
              onClick={() => {
                if (!selectedProductId) {
                  setWarnTitle('Select a product first');
                  setWarnBody('You need to select a product before choosing a logo/page.');
                  setWarnOpen(true);
                  return;
                }
                setShowProductPanel(false);
                setShowLogoPanel(true);
              }}
            />

            <ToolButton
              icon={Grid3X3}
              label="View With All Logos"
              title="Open all logos view"
              onClick={handleViewWithAllLogos}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100"
            />

            {hasFuturePlan && (
              <ToolButton icon={ArrowsUpFromLine} label="Update meta" onClick={handleUpdateMeta} />
            )}

            <ToolButton
              icon={Trash2}
              label="Clear All"
              title="Clear All Placements"
              onClick={handleClearAll}
              className="text-red-600 hover:bg-red-50"
            />

            <ToolButton
              icon={Trash2}
              label="Clear Cache"
              title="Clear local & server caches"
              onClick={async () => {
                window.dispatchEvent(new Event('ms-clear-cache'));
                localStorage.setItem('ms_force_noCache', '1');
                localStorage.setItem('ms_force_noCache_pages', '1');
                try {
                  await fetch('/api/ms/revalidate', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ tags: ['ms:products', 'ms:pages'] }),
                  });
                } catch {}
                alert('Cache cleared!');
              }}
              className="text-yellow-600 hover:bg-yellow-100"
            />

            {/* RIGHT SIDE: selected product + logo/page badges */}
            <div className="ml-auto flex items-center gap-3">
              {/* Product badge */}
              {selectedProductId && (
                <div className="flex items-center gap-2 border rounded-md px-2 py-1 bg-gray-50">
                  <img
                    src={getProductThumbUrl(selectedProduct) || imageUrl}
                    alt={selectedProduct?.name || 'Product'}
                    className="w-8 h-8 rounded object-cover"
                    draggable={false}
                  />
                  <div className="leading-4">
                    <div className="text-xs font-semibold truncate max-w-[180px]">
                      #{selectedProductId} — {selectedProduct?.name || 'Product'}
                    </div>
                    <div className="text-[10px] text-gray-500">Selected product</div>
                  </div>
                </div>
              )}

              {/* Logo/Page badge + remove button */}
              {(logoPreviewUrl || selectedPage) && (
                <div className="flex items-center gap-2 border rounded-md px-2 py-1 bg-gray-50">
                  {logoPreviewUrl ? (
                    <img
                      src={logoPreviewUrl}
                      alt={selectedPage?.title || 'Logo'}
                      className="w-8 h-8 rounded object-contain bg-white"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-100" />
                  )}
                  <div className="leading-4">
                    <div className="text-xs font-semibold truncate max-w-[160px]">
                      {selectedPage ? `#${selectedPage.id} — ${selectedPage.title}` : 'Logo'}
                    </div>
                    <div className="text-[10px] text-gray-500">Selected logo/page</div>
                  </div>

                  {/* NEW: remove logo/page */}
                  <button
                    type="button"
                    title="Remove selected logo/page"
                    aria-label="Remove selected logo/page"
                    onClick={handleRemoveSelectedLogoPage}
                    className="ml-1 p-1 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div
            id="canvasMainWrapper"
            className="flex-1 overflow-auto bg-gray-100 p-6"
            onClick={() => {
              if (showProductPanel) setShowProductPanel(false);
            }}
          >
            <ImageCanvas
              imageUrl={imageUrl}
              mappings={mappings}
              setMappings={setMappings}
              selectedMapping={selectedMapping}
              setSelectedMapping={setSelectedMapping}
            />
          </div>
        </div>
      </div>

      {/* Edit mapping modal */}
      <EditMappingModal
        mapping={selectedMapping}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={updated => {
          setMappings(prev => prev.map(m => (m.id === updated.id ? updated : m)));
          setSelectedMapping(updated);
        }}
        existingNames={(mappings || [])
          .filter(m => m.id !== selectedMapping?.id)
          .map(m => (m?.name || '').trim())}
      />

      {/* Product selector */}
      <EditImagePanel
        open={showProductPanel}
        onClose={() => setShowProductPanel(false)}
        onSelect={(url, productId, product) => {
          setImageUrl(url);
          setSelectedProductId(productId);
          setSelectedProduct(product || null);
          setMappingSource(null); // reset hint unless page overrides later

          // NEW: reset page-placements toggle/candidate when product changes
          setUsePagePlacements(false);
          setPagePlacementsCandidate([]);
          setPagePlacementsAvailable(false);

          // NEW: preload extra_print_price from product (auto-check input value)
          const pre = findExtraPrintPriceInProduct(product);
          if (!onlyThisPage && Number.isFinite(pre)) {
            setAddExtraPrice(true);
            setExtraPrice(String(pre));
          } else {
            setAddExtraPrice(false);
            setExtraPrice('');
          }

          // [PATCH] Added: set Only One from product meta if present
          // If the product carries "onlyone" truthy value, turn the toggle on; otherwise off.
          // (values can be "1", 1, "true", true)
          const onlyOneFromProduct = getOnlyOneFromProduct(product);
          setOnlyOne(onlyOneFromProduct);

          // Build placements if product has any
          const prodNorm = (() => {
            const raw = product?.placement_coordinates;
            let coords = Array.isArray(raw) ? raw : [];
            if (!coords.length && typeof raw === 'string') {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) coords = parsed;
              } catch {}
            }
            const baseW = Number(product?.thumbnail_meta?.width) || 0;
            const baseH = Number(product?.thumbnail_meta?.height) || 0;
            return normalizeCoords(coords, baseW, baseH);
          })();

          if (prodNorm.length > 0) {
            setMappings(prodNorm);
            setSelectedMapping(prodNorm[0]);
          } else {
            setMappings([]);
            setSelectedMapping(null);
          }

          setShowProductPanel(false);
        }}
      />

      {/* Logo/page selector */}
      <EditLogoPanel
        open={showLogoPanel}
        onClose={() => setShowLogoPanel(false)}
        onSelect={(publicId, page) => {
          // Guard: product must be selected
          if (!selectedProductId) {
            setWarnTitle('Select a product first');
            setWarnBody('You need to select a product before choosing a logo/page.');
            setWarnOpen(true);
            setShowLogoPanel(true);
            return;
          }

          // Validate selected product exists in this page's ACF selected_products
          const allowedProducts = Array.isArray(page?.acf?.selected_products)
            ? page.acf.selected_products
            : [];
          const ok = allowedProducts.some(p => Number(p?.id) === Number(selectedProductId));

          if (!ok) {
            setWarnTitle('Product not allowed for this page');
            setWarnBody(
              `The selected page does not contain product #${selectedProductId} in its allowed product list.\n\n` +
                `Page: #${page?.id} — ${page?.title}`
            );
            setWarnOpen(true);
            setTimeout(() => setShowLogoPanel(true), 0);
            return;
          }

          // Accept logo/page selection
          setLogoId(publicId || '');
          const darkerUrl = page?.acf?.logo_darker?.url || '';
          setLogoPreviewUrl(darkerUrl || (publicId ? cldUrlFromPublicId(publicId) : ''));

          setSelectedPage(page ? { id: page.id, title: page.title, slug: page.slug } : null);
          setSelectedPageFull(page || null);
          setOnlyThisPage(false); // always uncheck when a new logo/page is chosen
          setCompanyLogos({
            logo_darker: page?.acf?.logo_darker || null,
            logo_lighter: page?.acf?.logo_lighter || null,
            back_lighter: page?.acf?.back_lighter || null,
            back_darker: page?.acf?.back_darker || null,
          });

          // NEW: prepare (but DO NOT apply) page candidate + availability
          const { list, available } = (() => {
            const pagePC = page?.meta?.placement_coordinates;
            const key = String(selectedProductId);
            if (pagePC && typeof pagePC === 'object' && !Array.isArray(pagePC)) {
              const chosen = parseMaybeJsonArray(pagePC[key]);
              if (Array.isArray(chosen) && chosen.length) {
                const baseW = Number(selectedProduct?.thumbnail_meta?.width) || 0;
                const baseH = Number(selectedProduct?.thumbnail_meta?.height) || 0;
                return { list: normalizeCoords(chosen, baseW, baseH), available: true };
              }
              return { list: [], available: false };
            }
            return { list: [], available: false };
          })();

          setUsePagePlacements(false);
          setPagePlacementsCandidate(list);
          setPagePlacementsAvailable(available);
          setMappingSource(null); // not applied yet

          setShowLogoPanel(false);
        }}
        folder="Experiment"
      />

      {/* Result Modal */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="!max-w-[520px]">
          <div className="w-full flex flex-col items-center justify-center text-center py-4">
            {resultOk ? (
              <CheckCircle2 className="w-12 h-12 text-green-600 mb-2" />
            ) : (
              <XCircle className="w-12 h-12 text-red-600 mb-2" />
            )}
            <DialogTitle className="text-xl font-semibold mb-2">
              {resultOk ? 'Update Successful' : 'Update Failed'}
            </DialogTitle>
            <p className="text-gray-600">{resultMsg}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Placement Mapping Modal */}
      <Dialog open={placementMapOpen} onOpenChange={setPlacementMapOpen}>
        <DialogContent className="!max-w-[1100px] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Placement Mapping</DialogTitle>
          <div className="w-full h-full p-6 flex items-center justify-center bg-white">
            <div className="relative max-w-[1000px] max-h-[80vh]">
              <img
                src={imageUrl}
                alt="Placement mapping"
                className="max-w-full max-h-[80vh] object-contain rounded"
                draggable={false}
              />
              <div className="absolute inset-0 pointer-events-none">
                {mappings.map(b => (
                  <div
                    key={b.id}
                    className="absolute border-2 border-blue-600/80 bg-blue-300/20"
                    style={{
                      left: `${(b.xPercent || 0) * 100}%`,
                      top: `${(b.yPercent || 0) * 100}%`,
                      width: `${(b.wPercent || 0) * 100}%`,
                      height: `${(b.hPercent || 0) * 100}%`,
                      transform: `rotate(${Number(b.rotation) || 0}deg)`,
                    }}
                  >
                    <div className="absolute -top-5 left-0 text-[11px] bg-blue-600 text-white px-1 py-0.5 rounded">
                      {b.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logos Mapping Modal (ACTIVE + manual add) */}
      <Dialog open={logosMapOpen} onOpenChange={setLogosMapOpen}>
        <DialogContent className="!max-w-[1200px] p-0 overflow-hidden" dir="ltr">
          <div className="bg-white">
            <div className="px-6 pt-6 flex flex-col align-center text-center">
              <DialogTitle className="text-2xl font-semibold">Logos Mapping Preview</DialogTitle>
              <div className="text-sm text-muted-foreground mt-1">
                Showing <b>Active</b> placements by default. Click any area button below to
                temporarily add inactive areas.
              </div>
            </div>
            <div className="w-full flex flex-col items-center justify-center px-6 pb-6">
              <div className="relative w-full h-[70vh] max-h-[780px] flex items-center justify-center bg-gray-50 rounded-xl mt-4 overflow-hidden">
                {logosSliderImages.length > 0 ? (
                  <img
                    key={logosSliderIdx}
                    src={logosSliderImages[logosSliderIdx].src}
                    alt={logosSliderImages[logosSliderIdx].title}
                    className={`max-h-[70vh] max-w-full object-contain transition-opacity duration-200 ${logosPreviewLoading ? 'opacity-60' : 'opacity-100'}`}
                    draggable={false}
                  />
                ) : (
                  <div className="text-gray-500">Select a product & a logo/page to preview.</div>
                )}

                {logosPreviewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {logosSliderImages.length > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
                    onClick={() =>
                      setLogosSliderIdx(
                        p => (p - 1 + logosSliderImages.length) % logosSliderImages.length
                      )
                    }
                    type="button"
                    title="Previous"
                  >
                    Prev
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
                    onClick={() => setLogosSliderIdx(p => (p + 1) % logosSliderImages.length)}
                    type="button"
                    title="Next"
                  >
                    Next
                  </button>
                </div>
              )}

              {logosSliderImages.length > 1 &&
                selectedProduct?.acf?.group_type === 'Group' &&
                Array.isArray(selectedProduct?.acf?.color) && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    {selectedProduct.acf.color.map((c, i) => {
                      const active = i === logosSliderIdx;
                      const dark = isDark(c?.color_hex_code || '#ffffff');
                      return (
                        <button
                          key={i}
                          onClick={() => setLogosSliderIdx(i)}
                          title={c?.title || `Color ${i + 1}`}
                          className={`px-3 py-1 rounded-full border text-xs font-medium shadow-sm transition cursor-pointer ${active ? 'ring-2 ring-sky-500' : ''}`}
                          style={{
                            background: c?.color_hex_code || '#ffffff',
                            color: dark ? '#ffffff' : '#111111',
                            borderColor: dark ? '#ffffff66' : '#00000022',
                          }}
                          type="button"
                        >
                          {c?.title || `Color ${i + 1}`}
                        </button>
                      );
                    })}
                  </div>
                )}

              {/* Area buttons */}
              {mappings.length > 0 && (
                <div className="mt-6 w-full max-w-[1000px]">
                  <div className="text-sm text-muted-foreground mb-2 text-center">Areas</div>
                  <div className="flex flex-wrap align-center justify-center gap-2">
                    {mappings.map(m => {
                      const nm = m?.name || '';
                      const origActive = !!m?.active;
                      const isAdded = logosManualOn.has(nm);
                      const isRemoved = logosManualOff.has(nm);
                      const effectiveActive = isRemoved ? false : isAdded ? true : origActive;

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const wasActive = originalActiveByName.get(nm);
                            setLogosManualOn(prev => {
                              const next = new Set(prev);
                              if (next.has(nm)) {
                                next.delete(nm);
                                return next;
                              }
                              if (!wasActive && !logosManualOff.has(nm)) next.add(nm);
                              return next;
                            });
                            setLogosManualOff(prev => {
                              const next = new Set(prev);
                              if (next.has(nm)) {
                                next.delete(nm);
                                return next;
                              }
                              if (wasActive && !logosManualOn.has(nm)) next.add(nm);
                              return next;
                            });
                          }}
                          className={`px-3 py-1 rounded-full border text-xs font-medium transition
              ${
                effectiveActive
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : isAdded
                    ? 'bg-sky-600 text-white border-sky-600'
                    : isRemoved
                      ? 'bg-gray-300 text-gray-700 border-gray-300'
                      : 'bg-white text-primary border-gray-300 hover:bg-gray-50'
              }`}
                          title={nm}
                        >
                          {nm}
                          {effectiveActive
                            ? ' • active'
                            : isAdded
                              ? ' • added'
                              : isRemoved
                                ? ' • off'
                                : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logos Mapping (with overlay rectangles) */}
      <Dialog open={logosOverlayMapOpen} onOpenChange={setLogosOverlayMapOpen}>
        <DialogContent className="!max-w-[1200px] p-0 overflow-hidden">
          <div className="bg-white">
            <div className="px-6 pt-6">
              <DialogTitle className="text-2xl font-semibold">
                Logos Mapping Preview (with overlay)
              </DialogTitle>
            </div>

            <div className="w-full flex flex-col items-center justify-center px-6 pb-6">
              <div className="w-full h-[70vh] max-h-[780px] flex items-center justify-center bg-gray-50 rounded-xl mt-4 overflow-hidden">
                {logosSliderImagesOverlay.length > 0 ? (
                  <img
                    key={logosSliderIdx}
                    src={logosSliderImagesOverlay[logosSliderIdx].src}
                    alt={logosSliderImagesOverlay[logosSliderIdx].title}
                    className="max-h-[70vh] max-w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="text-gray-500">Select a product & a logo/page to preview.</div>
                )}
              </div>

              {logosSliderImagesOverlay.length > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
                    onClick={() =>
                      setLogosSliderIdx(
                        p =>
                          (p - 1 + logosSliderImagesOverlay.length) %
                          logosSliderImagesOverlay.length
                      )
                    }
                    type="button"
                    title="Previous"
                  >
                    Prev
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
                    onClick={() =>
                      setLogosSliderIdx(p => (p + 1) % logosSliderImagesOverlay.length)
                    }
                    type="button"
                    title="Next"
                  >
                    Next
                  </button>
                </div>
              )}

              {logosSliderImagesOverlay.length > 1 &&
                selectedProduct?.acf?.group_type === 'Group' &&
                Array.isArray(selectedProduct?.acf?.color) && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    {selectedProduct.acf.color.map((c, i) => {
                      const active = i === logosSliderIdx;
                      const dark = isDark(c?.color_hex_code || '#ffffff');
                      return (
                        <button
                          key={i}
                          onClick={() => setLogosSliderIdx(i)}
                          title={c?.title || `Color ${i + 1}`}
                          className={`px-3 py-1 rounded-full border text-xs font-medium shadow-sm transition cursor-pointer ${active ? 'ring-2 ring-sky-500' : ''}`}
                          style={{
                            background: c?.color_hex_code || '#ffffff',
                            color: dark ? '#ffffff' : '#111111',
                            borderColor: dark ? '#ffffff66' : '#00000022',
                          }}
                          type="button"
                        >
                          {c?.title || `Color ${i + 1}`}
                        </button>
                      );
                    })}
                  </div>
                )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warning Dialog */}
      <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
        <DialogContent className="!max-w-[560px]" dir="ltr">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {warnTitle || 'Warning'}
          </DialogTitle>
          <div className="mt-2 text-gray-700 whitespace-pre-line">{warnBody}</div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
              onClick={() => setWarnOpen(false)}
              type="button"
            >
              OK
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="!max-w-[560px]" dir="ltr">
          <DialogTitle className="text-xl font-semibold">Confirm</DialogTitle>
          <div className="mt-2 text-gray-700 whitespace-pre-line">
            {confirmBody || 'Are you sure?'}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
              onClick={() => setConfirmOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              onClick={async () => {
                const fn = confirmAction;
                setConfirmOpen(false);
                if (typeof fn === 'function') await fn();
              }}
              type="button"
            >
              Yes, Continue
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
