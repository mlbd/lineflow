'use client'

import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export default function ImageCanvas({
  imageUrl,
  mappings,
  setMappings,
  selectedMapping,
  setSelectedMapping,
}) {
  const imageRef = useRef(null)
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  const [containerStyle, setContainerStyle] = useState({})
  const [isAlignCenter, setAlignCenter] = useState(true)
  const [imageStyle, setImageStyle] = useState({})

  const isDragging = useRef(false)
  const isResizing = useRef(false)
  const isCreating = useRef(false)

  const startX = useRef(0)
  const startY = useRef(0)
  const dragOffset = useRef({ x: 0, y: 0 })
  const startSize = useRef({ w: 0, h: 0 })

  // Handle image sizing when imageUrl changes
  // Handle image sizing when imageUrl changes
  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return

    const img = new Image()
    img.onload = () => {
      const canvasRect = canvasRef.current.getBoundingClientRect()
      const canvasWidth = canvasRect.width
      const canvasHeight = canvasRect.height

      const imageWidth = img.naturalWidth
      const imageHeight = img.naturalHeight

      if (imageWidth < canvasWidth && imageHeight < canvasHeight) {
        setAlignCenter(true);

        setContainerStyle({
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
        })
        setImageStyle({
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
        })

      } else {
        setAlignCenter(false);

        setContainerStyle({
          width: '100%',
          height: 'auto',
        })
        setImageStyle({
          width: '100%',
          height: 'auto',
        })
      }

    }
    img.src = imageUrl
    console.log("isAlignCenter", isAlignCenter);
  }, [imageUrl])

  // Create new box on mousedown
  const handleMouseDown = (e) => {
    if (isDragging.current || isResizing.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    isCreating.current = true
    startX.current = x
    startY.current = y

    const newBox = {
      id: Date.now(),
      name: `area_${mappings.length + 1}`,
      x,
      y,
      w: 1,
      h: 1,
    }

    setMappings((prev) => [...prev, newBox])
    setSelectedMapping(newBox)
  }

  const handleMouseMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isCreating.current && selectedMapping) {
      const newW = Math.abs(x - startX.current)
      const newH = Math.abs(y - startY.current)
      const newX = Math.min(x, startX.current)
      const newY = Math.min(y, startY.current)

      updateSelected({
        ...selectedMapping,
        x: newX,
        y: newY,
        w: newW,
        h: newH,
      })
    }

    if (isDragging.current && selectedMapping) {
      const newX = x - dragOffset.current.x
      const newY = y - dragOffset.current.y
      updateSelected({ ...selectedMapping, x: newX, y: newY })
    }

    if (isResizing.current && selectedMapping) {
      const deltaX = x - startX.current
      const deltaY = y - startY.current
      updateSelected({
        ...selectedMapping,
        w: Math.max(10, startSize.current.w + deltaX),
        h: Math.max(10, startSize.current.h + deltaY),
      })
    }
  }

  const handleMouseUp = () => {
    isCreating.current = false
    isDragging.current = false
    isResizing.current = false
  }

  const updateSelected = (updated) => {
    setMappings((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m))
    )
    setSelectedMapping(updated)
  }

  const handleBoxMouseDown = (e, mapping) => {
    e.stopPropagation()
    isDragging.current = true
    setSelectedMapping(mapping)

    const rect = containerRef.current.getBoundingClientRect()
    dragOffset.current = {
      x: e.clientX - rect.left - mapping.x,
      y: e.clientY - rect.top - mapping.y,
    }
  }

  const handleResizeStart = (e, mapping) => {
    e.stopPropagation()
    isResizing.current = true
    startX.current = e.clientX - containerRef.current.getBoundingClientRect().left
    startY.current = e.clientY - containerRef.current.getBoundingClientRect().top
    startSize.current = { w: mapping.w, h: mapping.h }
  }

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [selectedMapping])

  useEffect(() => {
    console.log("Updated isAlignCenter:", isAlignCenter);
  }, [isAlignCenter]);

  return (
    <div
      id="placementCanvas"
      ref={canvasRef}
      className={`flex justify-center min-h-[400px] ${isAlignCenter !== true ? 'items-start' : 'items-center'}`}
      style={isAlignCenter === true ? { height: 'calc(100vh - 117px)' } : {}}
    >
      <div 
        id="placementCanvasContainer" 
        className="relative border overflow-hidden cursor-crosshair"
        style={containerStyle}
      >
        <div
          ref={containerRef}
          className="relative bg-muted"
          style={containerStyle}
          onMouseDown={handleMouseDown}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="T-Shirt"
            className="pointer-events-none select-none"
            style={imageStyle}
          />
          {mappings.map((box) => (
            <div
              key={box.id}
              className={cn(
                'absolute border-2 bg-blue-200/30 cursor-move',
                box.id === selectedMapping?.id
                  ? 'border-blue-600'
                  : 'border-red-400'
              )}
              style={{
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
              }}
              onMouseDown={(e) => handleBoxMouseDown(e, box)}
            >
              <div className="text-xs bg-blue-600 text-white px-1 py-0.5 absolute -top-5 left-0 rounded">
                {box.name}
              </div>
              <div
                className="w-3 h-3 bg-blue-600 border border-white absolute bottom-0 right-0 cursor-nw-resize"
                onMouseDown={(e) => handleResizeStart(e, box)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}