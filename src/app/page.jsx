'use client';

import { useState, useEffect } from 'react';
import { Image, Plus, Trash2, ArrowsUpFromLine, Upload, Grid3X3 } from 'lucide-react';

import ImageCanvas from '@/components/ImageCanvas';
import MappingList from '@/components/MappingList';
import OutputPanel from '@/components/OutputPanel';
import EditMappingModal from '@/components/EditMappingModal';
import ProductPanel from '@/components/ProductPanel'; // NEW!
import EditLogoPanel from '@/components/EditLogoPanel';
import UploadImageModal from '@/components/UploadImageModal';

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const WP_URL = process.env.NEXT_PUBLIC_WP_SITE_URL;

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

export default function HomePage() {
  const [imageUrl, setImageUrl] = useState(
    `https://res.cloudinary.com/${cloudName}/image/upload/V-Neck_L-Gray_ulfprv.jpg`
  );
  const [mappings, setMappings] = useState([]);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [showProductPanel, setShowProductPanel] = useState(false); // CHANGED
  const [showLogoPanel, setShowLogoPanel] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [logoId, setLogoId] = useState('square');
  const [selectedProductId, setSelectedProductId] = useState(null); // NEW
  const [hasFuturePlan, setHasFuturePlan] = useState(false);

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

  useEffect(() => {
    console.log('mappings', mappings);
    const dataToPass = {
      imageUrl,
      mappings,
      logoId,
      selectedProductId, // Save this for placements
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

  // NEW: Save Placement API
  const handleSavePlacement = async () => {
    if (!selectedProductId) return alert('Select a product first!');
    const res = await fetch(`${WP_URL}/wp-json/mini-sites/v1/update=placement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: selectedProductId,
        placements: mappings,
      }),
    });
    const data = await res.json();
    alert(data.message || 'Placements saved!');
  };

  return (
    <main className="w-full flex justify-center bg-muted min-h-screen">
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
          {/* NEW: Save placement button */}
          <button
            className={`mt-4 w-full py-2 cursor-pointer rounded font-semibold transition
              ${
                mappings.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            onClick={handleSavePlacement}
            disabled={mappings.length === 0}
          >
            Update Placement
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
              label="Clear Product Cache"
              onClick={() => {
                localStorage.removeItem('mini_site_products_cache');
                alert('Product cache cleared!');
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

      <EditMappingModal
        mapping={selectedMapping}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={updated => {
          setMappings(prev => prev.map(m => (m.id === updated.id ? updated : m)));
          setSelectedMapping(updated);
        }}
      />

      {/* NEW: ProductPanel for Select Product */}
      <ProductPanel
        open={showProductPanel}
        onClose={() => setShowProductPanel(false)}
        onSelect={(url, productId) => {
          setImageUrl(url);
          setSelectedProductId(productId);
          setShowProductPanel(false);
        }}
        wpUrl={WP_URL}
      />

      <EditLogoPanel
        open={showLogoPanel}
        onClose={() => setShowLogoPanel(false)}
        onSelect={publicId => {
          setLogoId(publicId);
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
    </main>
  );
}
