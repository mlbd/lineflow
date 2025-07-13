'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Image, Plus, Trash2 } from 'lucide-react'

import ImageCanvas from '@/components/ImageCanvas'
import MappingList from '@/components/MappingList'
import OutputPanel from '@/components/OutputPanel'
import EditMappingModal from '@/components/EditMappingModal'
import EditImagePanel from '@/components/EditImagePanel'

function ToolButton({ icon: Icon, label, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-[#eee] transition cursor-pointer ${className}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  )
}

export default function HomePage() {
  const [imageUrl, setImageUrl] = useState(
    'https://res.cloudinary.com/dfuecvdyc/image/upload/Polo-Navy_gnpa40.jpg'
  )
  const [mappings, setMappings] = useState([])
  const [selectedMapping, setSelectedMapping] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [showEditPanel, setShowEditPanel] = useState(false)

  const handleDelete = (id) => {
    setMappings((prev) => prev.filter((m) => m.id !== id))
    if (selectedMapping?.id === id) setSelectedMapping(null)
  }

  const handleEdit = (id) => {
    const mapping = mappings.find((m) => m.id === id)
    if (mapping) {
      setSelectedMapping(mapping)
      setEditOpen(true)
    }
  }

  const handleClearAll = () => {
    setMappings([])
    setSelectedMapping(null)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Del') && selectedMapping) {
        handleDelete(selectedMapping.id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedMapping])

  return (
    <main className="w-full flex justify-center bg-muted min-h-screen">
      <div className="w-full max-w-[1920px] flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="w-[300px] bg-white border-r overflow-y-auto p-4 space-y-6">
          <h1 className="text-2xl font-bold">Placement Editor</h1>

          <MappingList
            mappings={mappings}
            selectedId={selectedMapping?.id}
            onSelect={(id) => {
              const mapping = mappings.find((m) => m.id === id)
              if (mapping) setSelectedMapping(mapping)
            }}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />

          <OutputPanel
            imageUrl={imageUrl}
            mappings={mappings}
            logoId="file_vchdkq"
          />
        </div>

        {/* Canvas Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Toolbar */}
          <div id="toolbarHeader" className="h-[55px] bg-white border-b flex items-center px-6 gap-4 text-sm">
            <ToolButton 
              icon={Image} 
              label="Edit Image" 
              onClick={() => setShowEditPanel(true)} 
            />
            <ToolButton 
              icon={Plus} 
              label="Add Logo" 
              onClick={() => alert('Coming soon...')} 
            />
            <ToolButton 
              icon={Trash2} 
              label="Clear All" 
              onClick={handleClearAll}
              className="text-red-600 hover:bg-red-50"
            />
          </div>

          {/* Image Canvas */}
          <div
            id="canvasMainWrapper"
            className="flex-1 overflow-auto bg-gray-100 p-6"
            onClick={() => {
              if (showEditPanel) setShowEditPanel(false)
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

      {/* Edit Modal */}
      <EditMappingModal
        mapping={selectedMapping}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={(updated) => {
          setMappings((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          )
          setSelectedMapping(updated)
        }}
      />

      <EditImagePanel
        open={showEditPanel}
        onClose={() => setShowEditPanel(false)}
        onSelect={(url) => setImageUrl(url)}
      />
    </main>
  )
}