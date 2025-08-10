'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Image as IconImage,
  Plus,
  Trash2,
  ArrowsUpFromLine,
  Upload,
  Grid3X3,
  Map,
  Images,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import ImageCanvas from '@/components/ImageCanvas';
import MappingList from '@/components/MappingList';
import OutputPanel from '@/components/OutputPanel';
import EditMappingModal from '@/components/EditMappingModal';
import EditImagePanel from '@/components/EditImagePanel';
import EditLogoPanel from '@/components/EditLogoPanel';
import UploadImageModal from '@/components/UploadImageModal';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { generateProductImageUrl } from '@/utils/cloudinaryMockup';

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

export default function HomePage() {
  const [imageUrl, setImageUrl] = useState(
    `https://res.cloudinary.com/${cloudName}/image/upload/V-Neck_L-Gray_ulfprv.jpg`
  );
  const [mappings, setMappings] = useState([]);
  const [selectedMapping, setSelectedMapping] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [showProductPanel, setShowProductPanel] = useState(false);
  const [showLogoPanel, setShowLogoPanel] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [logoId, setLogoId] = useState('square');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null); // full product
  const [selectedPage, setSelectedPage] = useState(null); // full page (if provided)
  const [companyLogos, setCompanyLogos] = useState({}); // logos to feed cloudinary builder

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
  const [logosSliderIdx, setLogosSliderIdx] = useState(0);

  // Update-only-for-page checkbox
  const [onlyThisPage, setOnlyThisPage] = useState(false);

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

  const handleClearAll = () => {
    setMappings([]);
    setSelectedMapping(null);
  };

  const handleUpdateMeta = () => {
    alert('Coming Soon..');
  };

  const handleUploadSelect = (value, type) => {
    if (type === 'background') {
      setImageUrl(value);
    } else if (type === 'logo') {
      setLogoId(value);
    }
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

  // === Update Placement API ===
  const handleSavePlacement = async () => {
    if (!selectedProductId || mappings.length === 0) return;

    setIsSaving(true); // freeze everything
    setResultMsg('');
    setResultOk(false);
    setResultOpen(false);

    try {
      const res = await fetch(`${WP_URL}/wp-json/mini-sites/v1/update=placement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProductId,
          placements: mappings,
          // only include page_id if user checked the checkbox
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

  // Build logos map images list (Cloudinary) for slider
  const logosSliderImages = useMemo(() => {
    const p = selectedProduct;
    const logos = companyLogos && Object.keys(companyLogos).length ? companyLogos : null;
    if (!p || !logos) return [];

    const isGroup = p?.acf?.group_type === 'Group';
    const colors = isGroup && Array.isArray(p?.acf?.color) ? p.acf.color : [];

    // If not a group with colors, still show one image
    if (!colors.length) {
      return [
        {
          src: generateProductImageUrl(p, logos, { max: 1400 }),
          title: p?.name || 'Preview',
          color_hex_code: p?.thumbnail_meta?.thumbnail_color || '#ffffff',
        },
      ];
    }

    return colors.map((c, i) => ({
      src: generateProductImageUrl(p, logos, { colorIndex: i, max: 1400 }),
      title: c?.title || `Color ${i + 1}`,
      color_hex_code: c?.color_hex_code || '#ffffff',
    }));
  }, [selectedProduct, companyLogos]);

  const updateButtonDisabled = isSaving || !selectedProductId || mappings.length === 0;

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

          <OutputPanel
            imageUrl={imageUrl}
            mappings={mappings}
            logoId={logoId}
            setLogoId={setLogoId}
          />

          {/* Update-only-for checkbox (appears if a page with title is selected) */}
          {selectedPage?.title && (
            <div className="px-6 -mt-4">
              <label className="flex items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 cursor-pointer"
                  checked={onlyThisPage}
                  onChange={e => setOnlyThisPage(e.target.checked)}
                />
                <span>
                  Update only for <b>&apos;{selectedPage.title}&apos;</b>
                </span>
              </label>
            </div>
          )}

          {/* Update Placement (wrapped with px-6) */}
          <div className="px-6">
            <button
              className={`mt-4 w-full py-2 cursor-pointer rounded font-semibold transition
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
        </div>

        {/* Canvas Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            id="toolbarHeader"
            className="h-[55px] bg-white border-b flex items-center px-6 gap-4 text-sm"
          >
            <ToolButton
              icon={IconImage}
              label="Select Product"
              title="Select Product"
              onClick={() => {
                // Clear placements immediately when switching product
                setMappings([]);
                setSelectedMapping(null);

                setShowLogoPanel(false);
                setShowUploadModal(false);
                setShowProductPanel(!showProductPanel);
              }}
            />
            <ToolButton
              icon={Plus}
              label="Select Logo"
              title="Select Logo / Page"
              onClick={() => {
                setShowProductPanel(false);
                setShowUploadModal(false);
                setShowLogoPanel(!showLogoPanel);
              }}
            />
            <ToolButton
              icon={Upload}
              label="Upload Image"
              title="Upload Background"
              onClick={() => {
                setShowProductPanel(false);
                setShowLogoPanel(false);
                setShowUploadModal(true);
              }}
            />

            <ToolButton
              icon={Grid3X3}
              label="View With All Logos"
              title="Open all logos view"
              onClick={handleViewWithAllLogos}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100"
            />

            {/* NEW icon buttons */}
            <ToolButton
              icon={Map}
              label="Placement Mapping"
              title="Placement Mapping"
              onClick={() => setPlacementMapOpen(true)}
            />
            <ToolButton
              icon={Images}
              label="Logos Mapping"
              title="Logos Mapping"
              onClick={() => {
                setLogosSliderIdx(0);
                setLogosMapOpen(true);
              }}
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
              title="Clear local caches"
              onClick={() => {
                // clear products/pages caches in panels
                window.dispatchEvent(new Event('ms-clear-cache'));
                alert('Cache cleared!');
              }}
              className="text-yellow-600 hover:bg-yellow-100"
            />
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

          // Build placements immediately if present
          const raw = product?.placement_coordinates;

          // Some backends return "" or stringified JSON; make it an array
          let coords = Array.isArray(raw) ? raw : [];
          if (!coords.length && typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) coords = parsed;
            } catch {}
          }

          const baseW = Number(product?.thumbnail_meta?.width) || 0;
          const baseH = Number(product?.thumbnail_meta?.height) || 0;

          const normalized = coords.map((c, idx) => {
            // Prefer provided percents; otherwise derive from px using base dims
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

          if (normalized.length > 0) {
            setMappings(normalized);
            setSelectedMapping(normalized[0]);
          } else {
            // Keep empty if none were saved
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
          setLogoId(publicId);

          // If the panel returns the full page, keep it
          if (page && page.acf) {
            setSelectedPage({ id: page.id, title: page.title, slug: page.slug });
            setCompanyLogos({
              logo_darker: page.acf.logo_darker || null,
              logo_lighter: page.acf.logo_lighter || null,
              back_lighter: page.acf.back_lighter || null,
              back_darker: page.acf.back_darker || null,
            });
          } else {
            // Fallback: synthesize logos object from public ID (darker only)
            setSelectedPage(prev => prev || null);
            setCompanyLogos({
              logo_darker: { url: cldUrlFromPublicId(publicId) },
            });
          }

          setShowLogoPanel(false);
        }}
        folder="Experiment"
        wpUrl={WP_URL}
      />

      <UploadImageModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSelect={handleUploadSelect}
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

      {/* Placement Mapping Modal: big image with placement boxes */}
<Dialog open={placementMapOpen} onOpenChange={setPlacementMapOpen}>
  <DialogContent className="!max-w-[1100px] p-0 overflow-hidden">
    {/* Required for accessibility (can be visually hidden) */}
    <DialogTitle className="sr-only">Placement Mapping</DialogTitle>

    <div className="w-full h-full p-6 flex items-center justify-center bg-white">
      <div className="relative max-w-[1000px] max-h-[80vh]">
        <img
          src={imageUrl}
          alt="Placement mapping"
          className="max-w-full max-h-[80vh] object-contain rounded"
          draggable={false}
        />
        {/* Non-interactive mapping boxes (percent-based) */}
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


      {/* Logos Mapping Modal: cloudinary-generated slider */}
      <Dialog open={logosMapOpen} onOpenChange={setLogosMapOpen}>
        <DialogContent className="!max-w-[1200px] p-0 overflow-hidden">
          <div className="bg-white">
            <div className="px-6 pt-6">
              <DialogTitle className="text-2xl font-semibold">
                Logos Mapping Preview
              </DialogTitle>
            </div>
            <div className="w-full flex flex-col items-center justify-center px-6 pb-6">
              {/* Image area */}
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

              {/* Controls */}
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

              {/* Dots built from color titles & hex */}
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
                        className={`px-3 py-1 rounded-full border text-xs font-medium shadow-sm transition cursor-pointer ${
                          active ? 'ring-2 ring-sky-500' : ''
                        }`}
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
    </main>
  );
}
