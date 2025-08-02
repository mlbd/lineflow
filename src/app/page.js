'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Image,
  Plus,
  Trash2,
  ArrowsUpFromLine,
  Upload,
  Grid3X3,
} from 'lucide-react';

import ImageCanvas from '@/components/ImageCanvas';
import MappingList from '@/components/MappingList';
import OutputPanel from '@/components/OutputPanel';
import EditMappingModal from '@/components/EditMappingModal';
import EditImagePanel from '@/components/EditImagePanel';
import EditLogoPanel from '@/components/EditLogoPanel';
import UploadImageModal from '@/components/UploadImageModal';

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
    'https://res.cloudinary.com/dfuecvdyc/image/upload/Polo-Navy_gnpa40.jpg'
  );
  const [mappings, setMappings] = useState([]);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showLogoPanel, setShowLogoPanel] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [logoId, setLogoId] = useState('file_vchdkq');
  const [hasFuturePlan, setHasFuturePlan] = useState(false);

  // Read ?future_plan param on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const futurePlan = urlParams.get('future_plan');
    setHasFuturePlan(futurePlan === 'true');
  }, []);

  // Memoize handler because it's used in useEffect and passed to children
  const handleDelete = useCallback(
    (id) => {
      setMappings((prev) => prev.filter((m) => m.id !== id));
      if (selectedMapping?.id === id) setSelectedMapping(null);
    },
    [selectedMapping]
  );

  // Memoize other handlers used as props or inside effects
  const handleEdit = useCallback(
    (id) => {
      const mapping = mappings.find((m) => m.id === id);
      if (mapping) {
        setSelectedMapping(mapping);
        setEditOpen(true);
      }
    },
    [mappings]
  );

  const handleClearAll = useCallback(() => {
    setMappings([]);
    setSelectedMapping(null);
  }, []);

  const handleUpdateMeta = useCallback(() => {
    alert('Coming Soon..');
  }, []);

  const handleUploadSelect = useCallback((value, type) => {
    if (type === 'background') {
      setImageUrl(value);
    } else if (type === 'logo') {
      setLogoId(value);
    }
  }, []);

  const handleViewWithAllLogos = useCallback(() => {
    if (mappings.length === 0) {
      alert('Please create at least one placement area before viewing logos.');
      return;
    }
    window.open('/logos', '_blank');
  }, [mappings.length]);

  // Persist logo page data to localStorage whenever it changes
  useEffect(() => {
    const dataToPass = {
      imageUrl,
      mappings,
      logoId,
    };
    localStorage.setItem('logo_page_data', JSON.stringify(dataToPass));
  }, [imageUrl, mappings, logoId]);

  // Delete mapping by keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Del') && selectedMapping) {
        handleDelete(selectedMapping.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMapping, handleDelete]);

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
            onSelect={(id) => {
              const mapping = mappings.find((m) => m.id === id);
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
        </div>

        {/* Canvas Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            id="toolbarHeader"
            className="h-[55px] bg-white border-b flex items-center px-6 gap-4 text-sm"
          >
            <ToolButton
              icon={Image}
              label={hasFuturePlan ? 'Product List' : 'Edit Image'}
              onClick={() => {
                setShowLogoPanel(false);
                setShowUploadModal(false);
                setShowEditPanel((prev) => !prev);
              }}
            />
            <ToolButton
              icon={Plus}
              label={hasFuturePlan ? 'Landing Pages' : 'Add Logo'}
              onClick={() => {
                setShowEditPanel(false);
                setShowUploadModal(false);
                setShowLogoPanel((prev) => !prev);
              }}
            />
            <ToolButton
              icon={Upload}
              label="Upload Image"
              onClick={() => {
                setShowEditPanel(false);
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
              <ToolButton
                icon={ArrowsUpFromLine}
                label="Update meta"
                onClick={handleUpdateMeta}
              />
            )}
            <ToolButton
              icon={Trash2}
              label="Clear All"
              onClick={handleClearAll}
              className="text-red-600 hover:bg-red-50"
            />
          </div>

          <div
            id="canvasMainWrapper"
            className="flex-1 overflow-auto bg-gray-100 p-6"
            onClick={() => {
              if (showEditPanel) setShowEditPanel(false);
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
        onSave={(updated) => {
          setMappings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          setSelectedMapping(updated);
        }}
      />

      <EditImagePanel
        open={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        onSelect={(url) => setImageUrl(url)}
      />

      <EditLogoPanel
        open={showLogoPanel}
        onClose={() => setShowLogoPanel(false)}
        onSelect={(publicId) => {
          setLogoId(publicId);
          setShowLogoPanel(false);
        }}
      />

      <UploadImageModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSelect={handleUploadSelect}
      />
    </main>
  );
}
