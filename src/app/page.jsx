'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Image as IconImage,
  Plus,
  Trash2,
  ArrowsUpFromLine,
  Grid3X3,
  Map,
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
import { generateProductImageUrl, generateProductImageUrlWithOverlay } from '@/utils/cloudinaryMockup';

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const WP_URL = process.env.NEXT_PUBLIC_WP_SITE_URL;

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

  // keep full page object so we can validate selected_products later
  const [selectedPageFull, setSelectedPageFull] = useState(null);

  // Update-only-for-page checkbox
  const [onlyThisPage, setOnlyThisPage] = useState(false);

   // === Page-level overrides (derived from the selected page) ===
  const pagePlacementMap = useMemo(() => {
    const src = selectedPageFull?.meta?.placement_coordinates;
    if (!src) return {};
    // prefer keyed object: { "<productId>": Placement[] }
    if (typeof src === 'object' && !Array.isArray(src)) return src;
    // tolerate JSON string
    if (typeof src === 'string') {
      try {
        const parsed = JSON.parse(src);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {}
    }
    return {};
  }, [selectedPageFull]);

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

  // replace your existing handleClearAll with this:
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
    setSelectedPageFull?.(null); // if you added selectedPageFull earlier
    setCompanyLogos({});
    setLogoId('');
    setLogoPreviewUrl('');

    // UI flags
    setOnlyThisPage(false);
    setLogosSliderIdx(0);

    // close any open panels/modals
    setShowProductPanel(false);
    setShowLogoPanel(false);
    setPlacementMapOpen(false);
    setLogosMapOpen(false);
    setLogosOverlayMapOpen(false);

    // clear persisted preview payload for /logos page
    try { localStorage.removeItem('logo_page_data'); } catch {}

    // (optional) also reset the canvas image to your default
    // comment OUT the next line if you prefer to keep the current image
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

  // checkbox guard: only allow "Update only for {page}" if product is allowed on that page
const handleToggleOnlyThisPage = (checked) => {
  if (!checked) {
    setOnlyThisPage(false);
    return;
  }

  // must have a selected product
  if (!selectedProductId) {
    setWarnTitle('Select a product first');
    setWarnBody('You need to select a product before scoping updates to a page.');
    setWarnOpen(true);
    setOnlyThisPage(false);
    return;
  }

  // must have a full page object with selected_products
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
    setOnlyThisPage(false);
    return;
  }

  // product must exist in that list
  const ok = allowed.some(p => Number(p?.id) === Number(selectedProductId));
  if (!ok) {
    setWarnTitle('Product not allowed for this page');
    setWarnBody(
      `Product #${selectedProductId}${selectedProduct?.name ? ` — ${selectedProduct.name}` : ''} is not in\n` +
      `the page’s allowed products.\n\nPage: #${selectedPage?.id} — ${selectedPage?.title}`
    );
    setWarnOpen(true);
    setOnlyThisPage(false);
    return;
  }

  // all good
  setOnlyThisPage(true);
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
  const ensureCloudinaryForMapping = (openFn) => {
    if (!selectedProductId) return; // disabled by canUpdate anyway
    if (!isCloudinaryUrl(currentThumbUrl)) {
      setWarnTitle('Cloudinary image required');
      setWarnBody(
        `The selected product’s thumbnail is not a Cloudinary URL, so we can’t resolve a public ID for logo mapping.\n\n` +
        `• Product: #${selectedProductId}${selectedProduct?.name ? ` — ${selectedProduct.name}` : ''}\n` +
        `• Current URL: ${currentThumbUrl || '(empty)'}\n\n` +
        `Please choose a product whose thumbnail comes from Cloudinary (e.g. contains “res.cloudinary.com”).`
      );
      setWarnOpen(true);
      return;
    }
    openFn(true);
  };

  // === Update Placement API (with confirm if not Cloudinary) ===
  const handleSavePlacement = async () => {
    if (!selectedProductId || mappings.length === 0) return;

    if (!isCloudinaryUrl(currentThumbUrl)) {
      setConfirmTitle('Proceed without Cloudinary image?');
      setConfirmBody(
        `This product’s thumbnail is not a Cloudinary URL. Saving placements will still update the product meta, ` +
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
    setResultMsg('');
    setResultOk(false);
    setResultOpen(false);

    try {
      const res = await fetch(`${WP_URL}/wp-json/mini-sites/v1/update-placement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProductId,
          placements: mappings,
          ...(onlyThisPage && selectedPage?.id ? { page_id: selectedPage.id } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      setResultOk(true);
      setResultMsg(data?.message || 'Placements saved!');
    } catch (err) {
      setResultOk(false);
      setResultMsg(err.message || 'Failed to update placements.');
    } finally {
      setIsSaving(false);
      setResultOpen(true);
    }
  };

  // Use the live rectangles drawn on the canvas for preview
  const previewProduct = useMemo(() => {
    if (!selectedProduct) return null;
    return {
      ...selectedProduct,
      placement_coordinates: Array.isArray(mappings) ? mappings : [],
    };
  }, [selectedProduct, mappings]);

  const logosSliderImages = useMemo(() => {
    const p = previewProduct;
    const logos =
      companyLogos && Object.keys(companyLogos).length ? companyLogos : null;
    if (!p || !logos) return [];

    const isGroup = p?.acf?.group_type === 'Group';
    const colors = isGroup && Array.isArray(p?.acf?.color) ? p.acf.color : [];

    if (!colors.length) {
      return [
        {
          src: generateProductImageUrl(p, logos, { 
            max: 1400,
            pagePlacementMap,
            customBackAllowedIds,
          }),
          title: p?.name || 'Preview',
          color_hex_code: p?.thumbnail_meta?.thumbnail_color || '#ffffff',
        },
      ];
    }

    return colors.map((c, i) => ({
      src: generateProductImageUrl(p, logos, { 
        colorIndex: i, 
        max: 1400,
        pagePlacementMap,
        customBackAllowedIds,
      }),
      title: c?.title || `Color ${i + 1}`,
      color_hex_code: c?.color_hex_code || '#ffffff',
    }));
  }, [previewProduct, companyLogos, pagePlacementMap, customBackAllowedIds]);

  const logosSliderImagesOverlay = useMemo(() => {
    const p = previewProduct;
    const logos =
      companyLogos && Object.keys(companyLogos).length ? companyLogos : null;
    if (!p || !logos) return [];

    const isGroup = p?.acf?.group_type === 'Group';
    const colors = isGroup && Array.isArray(p?.acf?.color) ? p.acf.color : [];

    const baseOpts = { max: 1400, overlayHex: '#000000', overlayOpacity: 20 };

    if (!colors.length) {
      return [{
        src: generateProductImageUrlWithOverlay(p, companyLogos, {
          ...baseOpts,
          max: 1400,
          pagePlacementMap,
          customBackAllowedIds,
        }),
        title: p?.name || 'Preview',
        color_hex_code: p?.thumbnail_meta?.thumbnail_color || '#ffffff',
      }];
    }

    return colors.map((c, i) => ({
      src: generateProductImageUrlWithOverlay(p, companyLogos, {
          ...baseOpts, 
          colorIndex: i,
          max: 1400,
          pagePlacementMap,
          customBackAllowedIds,
        }),
      title: c?.title || `Color ${i + 1}`,
      color_hex_code: c?.color_hex_code || '#ffffff',
    }));
  }, [previewProduct, companyLogos, pagePlacementMap, customBackAllowedIds]);

  const updateButtonDisabled = isSaving || !selectedProductId || mappings.length === 0;
  const canUpdate = !!selectedProductId && mappings.length > 0 && !isSaving;

  // Helpers
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
        ...c,
      };
    });
  };

  return (
    <main className="w-full flex justify-center bg-muted min-h-screen relative">
      {/* Freeze overlay while saving */}
      {isSaving && (
        <div className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[1px] pointer-events-auto flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-5 shadow-lg flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            <div className="text-sm text-gray-700">Updating placement… please wait</div>
          </div>
        </div>
      )}

      {/* Scrim behind side panels */}
      {(showProductPanel || showLogoPanel) && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => { setShowProductPanel(false); setShowLogoPanel(false); }}
          aria-hidden="true"
        />
      )}

      <div className="w-full max-w-[1920px] flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="w-[300px] bg-white border-r overflow-y-auto space-y-6">
          <h1 className="text-md bg-primary text-white font-bold border-b border-b-[#e6e8ea] h-[55px] flex items-center justify-center">
            Placement Editor
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
              <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-800">
                <Info className="mt-0.5 h-4 w-4" />
                <div className="text-xs leading-5">
                  Placements are loaded from <b>page</b> meta:&nbsp;
                  <b>#{mappingSource.pageId} — {mappingSource.pageTitle}</b>
                  <br />
                  (not from product meta:&nbsp;
                  <b>#{selectedProductId} — {selectedProduct?.name || 'Product'}</b>)
                </div>
              </div>
            </div>
          )}

          {/* Update-only-for checkbox */}
          {selectedPage?.title && (
            <div className="flex items-center justify-center m-0">
              <label className="flex items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 cursor-pointer"
                  checked={onlyThisPage}
                  onChange={e => handleToggleOnlyThisPage(e.target.checked)}
                />
                <span>
                  Update only for <b>&apos;{selectedPage.title}&apos;</b>
                </span>
              </label>
            </div>
          )}

          {/* Update Placement */}
          <div className="px-6">
            <button
              className={`mt-2 w-full py-2 cursor-pointer rounded font-semibold transition
                ${
                  updateButtonDisabled
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              onClick={handleSavePlacement}
              disabled={updateButtonDisabled}
            >
              {onlyThisPage && selectedPage?.title
                ? `Update for ${selectedPage.title}`
                : 'Update Placement'}
            </button>
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
              <Map size={24} />
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l9 5-9 5-9-5 9-5zm0 7l9 5-3 1.667-6-3.333-6 3.333L3 14l9-5zm0 7l6 3.333L12 22 6 19.333 12 16z"/>
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
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMapping(null);
                setShowLogoPanel(false);
                setShowProductPanel(true); // force open
                console.log('[UI] Opening Product panel');
              }}
            />

            <ToolButton
              icon={Plus}
              label="Select Logo"
              title="Select Logo / Page"
              onClick={() => {
                // Require product first
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
                // Clear browser caches in both panels
                window.dispatchEvent(new Event('ms-clear-cache'));

                // Revalidate product cache on the server (products route uses Next tag cache)
                try {
                  await fetch('/api/ms/revalidate', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ tags: ['ms:products', 'ms:pages'] }),
                  });
                } catch {}

                // // Force-refresh the pages API (bypasses its in-memory cache and rebuilds it)
                // try {
                //   await fetch('/api/ms/pages?force=1', { cache: 'no-store' });
                // } catch {}

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

              {/* Logo/Page badge */}
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
                    <div className="text-xs font-semibold truncate max-w-[180px]">
                      {selectedPage ? `#${selectedPage.id} — ${selectedPage.title}` : 'Logo'}
                    </div>
                    <div className="text-[10px] text-gray-500">Selected logo/page</div>
                  </div>
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

          // Build placements if product has any
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

          const normalized = normalizeCoords(coords, baseW, baseH);

          if (normalized.length > 0) {
            setMappings(normalized);
            setSelectedMapping(normalized[0]);
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
          const allowedProducts = Array.isArray(page?.acf?.selected_products) ? page.acf.selected_products : [];
          const ok = allowedProducts.some(p => Number(p?.id) === Number(selectedProductId));

          if (!ok) {
            setWarnTitle('Product not allowed for this page');
            setWarnBody(
              `The selected page does not contain product #${selectedProductId} in its allowed product list.\n\n` +
              `Page: #${page?.id} — ${page?.title}`
            );
            setWarnOpen(true);
            // re-open panel after warning so user can pick another
            setTimeout(() => setShowLogoPanel(true), 0);
            return;
          }

          // Accept logo/page
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

          // PRIORITY: page.meta.placement_coordinates by product ID
          // Supports keyed object: { "8109": [ ... ] }
          // and legacy array/string fallbacks
          const pagePC = page?.meta?.placement_coordinates;
          const key = String(selectedProductId);
          let chosen = [];

          const parseMaybeJsonArray = (val) => {
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') {
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) return parsed;
              } catch {}
            }
            return [];
          };

          if (pagePC && typeof pagePC === 'object' && !Array.isArray(pagePC)) {
            chosen = parseMaybeJsonArray(pagePC[key]);
          } else {
            chosen = parseMaybeJsonArray(pagePC);
          }

          console.log("chosen", chosen);
          console.log("page", page);

          if (chosen.length) {
            const baseW = Number(selectedProduct?.thumbnail_meta?.width) || 0;
            const baseH = Number(selectedProduct?.thumbnail_meta?.height) || 0;
            const normalized = normalizeCoords(chosen, baseW, baseH);
            setMappings(normalized);
            setSelectedMapping(normalized[0] || null);
            setMappingSource({ type: 'page', pageId: page.id, pageTitle: page.title, productId: selectedProductId });
          } else {
            setMappingSource(null);
          }

          setShowLogoPanel(false);
        }}
        folder="Experiment"
        wpUrl={WP_URL}
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

      {/* Logos Mapping Modal */}
      <Dialog open={logosMapOpen} onOpenChange={setLogosMapOpen}>
        <DialogContent className="!max-w-[1200px] p-0 overflow-hidden">
          <div className="bg-white">
            <div className="px-6 pt-6">
              <DialogTitle className="text-2xl font-semibold">Logos Mapping Preview</DialogTitle>
            </div>
            <div className="w-full flex flex-col items-center justify-center px-6 pb-6">
              <div className="w-full h-[70vh] max-h-[780px] flex items-center justify-center bg-gray-50 rounded-xl mt-4 overflow-hidden">
                {logosSliderImages.length > 0 ? (
                  <img
                    key={logosSliderIdx}
                    src={logosSliderImages[logosSliderIdx].src}
                    alt={logosSliderImages[logosSliderIdx].title}
                    className="max-h-[70vh] max-w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="text-gray-500">Select a product & a logo/page to preview.</div>
                )}
              </div>

              {logosSliderImages.length > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
                    onClick={() =>
                      setLogosSliderIdx((p) => (p - 1 + logosSliderImages.length) % logosSliderImages.length)
                    }
                    type="button"
                    title="Previous"
                  >
                    Prev
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
                    onClick={() => setLogosSliderIdx((p) => (p + 1) % logosSliderImages.length)}
                    type="button"
                    title="Next"
                  >
                    Next
                  </button>
                </div>
              )}

              {logosSliderImages.length > 1 && selectedProduct?.acf?.group_type === 'Group' && Array.isArray(selectedProduct?.acf?.color) && (
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

      {/* Logos Mapping (with overlay rectangles) */}
      <Dialog open={logosOverlayMapOpen} onOpenChange={setLogosOverlayMapOpen}>
        <DialogContent className="!max-w-[1200px] p-0 overflow-hidden">
          <div className="bg-white">
            <div className="px-6 pt-6">
              <DialogTitle className="text-2xl font-semibold">Logos Mapping Preview (with overlay)</DialogTitle>
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
                      setLogosSliderIdx((p) => (p - 1 + logosSliderImagesOverlay.length) % logosSliderImagesOverlay.length)
                    }
                    type="button"
                    title="Previous"
                  >
                    Prev
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
                    onClick={() => setLogosSliderIdx((p) => (p + 1) % logosSliderImagesOverlay.length)}
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

      {/* Warning Dialog (generic) */}
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

      {/* Confirm Dialog (for non-Cloudinary Update Placement) */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="!max-w-[560px]" dir="ltr">
          <DialogTitle className="text-xl font-semibold">Confirm</DialogTitle>
          <div className="mt-2 text-gray-700 whitespace-pre-line">{confirmBody || 'Are you sure?'}</div>
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
