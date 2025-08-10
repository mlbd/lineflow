'use client';

import { useState, useEffect } from 'react';
import {
  Image,
  Plus,
  Trash2,
  ArrowsUpFromLine,
  Upload,
  Grid3X3,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

import ImageCanvas from '@/components/ImageCanvas';
import MappingList from '@/components/MappingList';
import OutputPanel from '@/components/OutputPanel';
import EditMappingModal from '@/components/EditMappingModal';
import EditImagePanel from '@/components/EditImagePanel'; // <-- now used for Select Product
import EditLogoPanel from '@/components/EditLogoPanel';
import UploadImageModal from '@/components/UploadImageModal';

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const WP_URL = process.env.NEXT_PUBLIC_WP_SITE_URL;

// local cache keys this page clears
const LS_KEYS = ['ms_cache_products_all_v1', 'ms_cache_pages_all_v1'];

function ToolButton({ icon: Icon, label, onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-[#eee] transition cursor-pointer ${className}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

function ResultModal({ open, type = 'success', title, message, onClose }) {
  if (!open) return null;
  const isSuccess = type === 'success';
  const Icon = isSuccess ? CheckCircle : XCircle;
  const colorWrap = isSuccess ? 'text-green-600' : 'text-red-600';
  const bgRing = isSuccess ? 'bg-green-50 ring-green-200' : 'bg-red-50 ring-red-200';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl ring-1 ${bgRing} bg-white p-6 shadow-xl`}>
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 ${colorWrap}`} size={28} />
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{title}</h3>
            {message && <p className="text-sm text-gray-600 mt-1">{message}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="cursor-pointer inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-black transition"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function SavingOverlay({ visible, label = 'Updating placements…' }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="rounded-xl bg-white shadow-lg px-5 py-4 flex items-center gap-3">
        <Loader2 className="animate-spin" size={20} />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
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
  const [hasFuturePlan, setHasFuturePlan] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultType, setResultType] = useState('success');
  const [resultTitle, setResultTitle] = useState('');
  const [resultMessage, setResultMessage] = useState('');

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
    if (type === 'background') setImageUrl(value);
    else if (type === 'logo') setLogoId(value);
  };

  const handleViewWithAllLogos = () => {
    if (mappings.length === 0) {
      alert('Please create at least one placement area before viewing logos.');
      return;
    }
    window.open('/logos', '_blank');
  };

  useEffect(() => {
    const dataToPass = { imageUrl, mappings, logoId, selectedProductId };
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

  const handleSavePlacement = async () => {
    if (!selectedProductId) {
      setResultType('error');
      setResultTitle('Product not selected');
      setResultMessage('Please select a product before updating placements.');
      setResultOpen(true);
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${WP_URL}/wp-json/mini-sites/v1/update=placement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: selectedProductId, placements: mappings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setResultType('success');
      setResultTitle('Placements updated');
      setResultMessage(data?.message || 'Your placements were saved successfully.');
      setResultOpen(true);
    } catch (err) {
      setResultType('error');
      setResultTitle('Update failed');
      setResultMessage(err?.message || 'Something went wrong while saving placements.');
      setResultOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  // Clear both client + server caches
  const handleClearAllCaches = async () => {
    try {
      // client caches
      LS_KEYS.forEach(k => localStorage.removeItem(k));
      // notify panels to drop in-memory too
      window.dispatchEvent(new CustomEvent('ms-clear-cache'));

      // server caches
      await fetch('/api/ms/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: ['ms:products', 'ms:pages'] }),
      });
      alert('Cache cleared!');
    } catch {
      alert('Tried to clear cache, but something went wrong.');
    }
  };

  return (
    <main className="w-full flex justify-center bg-muted min-h-screen relative">
      <SavingOverlay visible={isSaving} />

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

          {/* Save placement */}
          <button
            className={`mt-4 w-full py-2 cursor-pointer rounded font-semibold transition
              ${
                mappings.length === 0 || isSaving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            onClick={handleSavePlacement}
            disabled={mappings.length === 0 || isSaving}
          >
            {isSaving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                Saving…
              </span>
            ) : (
              'Update Placement'
            )}
          </button>
        </div>

        {/* Canvas Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            id="toolbarHeader"
            className="h-[55px] bg-white border-b flex items-center px-6 gap-4 text-sm"
          >
            <ToolButton
              icon={Image}
              label="Select Product"
              onClick={() => {
                setShowLogoPanel(false);
                setShowUploadModal(false);
                setShowProductPanel(!showProductPanel);
              }}
            />
            <ToolButton
              icon={Plus}
              label="Select Logo"
              onClick={() => {
                setShowProductPanel(false);
                setShowUploadModal(false);
                setShowLogoPanel(!showLogoPanel);
              }}
            />
            <ToolButton
              icon={Upload}
              label="Upload Image"
              onClick={() => {
                setShowProductPanel(false);
                setShowLogoPanel(false);
                setShowUploadModal(true);
              }}
            />
            <ToolButton
              icon={Grid3X3}
              label="View With All Logos"
              onClick={handleViewWithAllLogos}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100"
            />
            {hasFuturePlan && (
              <ToolButton icon={ArrowsUpFromLine} label="Update meta" onClick={handleUpdateMeta} />
            )}
            <ToolButton
              icon={Trash2}
              label="Clear All"
              onClick={handleClearAll}
              className="text-red-600 hover:bg-red-50"
            />
            <ToolButton
              icon={Trash2}
              label="Clear Cache"
              onClick={handleClearAllCaches}
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

      {/* Edit Mapping */}
      <EditMappingModal
        mapping={selectedMapping}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={updated => {
          setMappings(prev => prev.map(m => (m.id === updated.id ? updated : m)));
          setSelectedMapping(updated);
        }}
      />

      {/* Panels */}
      <EditImagePanel
        open={showProductPanel}
        onClose={() => setShowProductPanel(false)}
        onSelect={(url, productId) => {
          setImageUrl(url);
          setSelectedProductId(productId);
          setShowProductPanel(false);
        }}
      />

      <EditLogoPanel
        open={showLogoPanel}
        onClose={() => setShowLogoPanel(false)}
        onSelect={publicId => {
          setLogoId(publicId);
          setShowLogoPanel(false);
        }}
      />

      <UploadImageModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSelect={(value, type) => {
          if (type === 'background') setImageUrl(value);
          if (type === 'logo') setLogoId(value);
        }}
      />

      <ResultModal
        open={resultOpen}
        type={resultType}
        title={resultTitle}
        message={resultMessage}
        onClose={() => setResultOpen(false)}
      />
    </main>
  );
}
