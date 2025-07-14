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
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 })
  const [imageDisplaySize, setImageDisplaySize] = useState({ width: 0, height: 0 })

  const isDragging = useRef(false)
  const isResizing = useRef(false)
  const isCreating = useRef(false)

  const startX = useRef(0)
  const startY = useRef(0)
  const dragOffset = useRef({ x: 0, y: 0 })
  const startSize = useRef({ w: 0, h: 0 })

  // Convert percentage-based coordinates to display pixels
  const toDisplayCoords = (mapping) => {
    if (!imageDisplaySize.width || !imageDisplaySize.height) return mapping
    
    return {
      ...mapping,
      x: (mapping.xPercent || 0) * imageDisplaySize.width,
      y: (mapping.yPercent || 0) * imageDisplaySize.height,
      w: (mapping.wPercent || 0) * imageDisplaySize.width,
      h: (mapping.hPercent || 0) * imageDisplaySize.height,
    }
  }

  // Convert display pixels to percentage-based coordinates
  const toPercentCoords = (mapping) => {
    if (!imageDisplaySize.width || !imageDisplaySize.height) return mapping
    
    return {
      ...mapping,
      xPercent: mapping.x / imageDisplaySize.width,
      yPercent: mapping.y / imageDisplaySize.height,
      wPercent: mapping.w / imageDisplaySize.width,
      hPercent: mapping.h / imageDisplaySize.height,
    }
  }

  // Update display size when image loads or resizes
  const updateImageSizes = () => {
    if (!imageRef.current || !imageRef.current.complete) return

    const displayRect = imageRef.current.getBoundingClientRect()
    const newDisplaySize = {
      width: imageRef.current.clientWidth,
      height: imageRef.current.clientHeight
    }

    const newNaturalSize = {
      width: imageRef.current.naturalWidth,
      height: imageRef.current.naturalHeight
    }

    setImageDisplaySize(newDisplaySize)
    setImageNaturalSize(newNaturalSize)
  }

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

      setImageNaturalSize({ width: imageWidth, height: imageHeight })

      if (imageWidth < canvasWidth && imageHeight < canvasHeight) {
        setAlignCenter(true)
        setContainerStyle({
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
        })
        setImageStyle({
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
        })
        setImageDisplaySize({ width: imageWidth, height: imageHeight })
      } else {
        setAlignCenter(false)
        setContainerStyle({
          width: '100%',
          height: 'auto',
        })
        setImageStyle({
          width: '100%',
          height: 'auto',
        })
        // Display size will be updated in the image onLoad callback
      }
    }
    img.src = imageUrl
  }, [imageUrl])

  // Update display size when image loads
  useEffect(() => {
    if (imageRef.current) {
      const img = imageRef.current
      
      if (img.complete) {
        updateImageSizes()
      } else {
        img.onload = updateImageSizes
      }
    }
  }, [imageStyle, containerStyle])

  // Listen for window resize to update display sizes
  useEffect(() => {
    const handleResize = () => {
      updateImageSizes()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
      // Store percentage coordinates
      xPercent: x / imageDisplaySize.width,
      yPercent: y / imageDisplaySize.height,
      wPercent: 1 / imageDisplaySize.width,
      hPercent: 1 / imageDisplaySize.height,
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

      const updated = {
        ...selectedMapping,
        x: newX,
        y: newY,
        w: newW,
        h: newH,
      }

      // Convert to percentage coordinates
      const withPercent = toPercentCoords(updated)
      updateSelected(withPercent)
    }

    if (isDragging.current && selectedMapping) {
      const newX = x - dragOffset.current.x
      const newY = y - dragOffset.current.y
      const updated = { ...selectedMapping, x: newX, y: newY }
      const withPercent = toPercentCoords(updated)
      updateSelected(withPercent)
    }

    if (isResizing.current && selectedMapping) {
      const deltaX = x - startX.current
      const deltaY = y - startY.current
      const updated = {
        ...selectedMapping,
        w: Math.max(10, startSize.current.w + deltaX),
        h: Math.max(10, startSize.current.h + deltaY),
      }
      const withPercent = toPercentCoords(updated)
      updateSelected(withPercent)
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
    const displayMapping = toDisplayCoords(mapping)
    dragOffset.current = {
      x: e.clientX - rect.left - displayMapping.x,
      y: e.clientY - rect.top - displayMapping.y,
    }
  }

  const handleResizeStart = (e, mapping) => {
    e.stopPropagation()
    isResizing.current = true
    startX.current = e.clientX - containerRef.current.getBoundingClientRect().left
    startY.current = e.clientY - containerRef.current.getBoundingClientRect().top
    const displayMapping = toDisplayCoords(mapping)
    startSize.current = { w: displayMapping.w, h: displayMapping.h }
  }

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [selectedMapping, imageDisplaySize])

  return (
    <div
      id="placementCanvas"
      ref={canvasRef}
      className="w-full h-full overflow-auto"
      style={{ height: 'calc(100vh - 117px)' }}
    >
      <div 
        className={`flex justify-center min-h-[400px] min-w-[1000px] ${isAlignCenter !== true ? 'items-start' : 'items-center'}`}
        style={{ height: '100%' }}
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
            {mappings.map((box) => {
              const displayBox = toDisplayCoords(box)
              return (
                <div
                  key={box.id}
                  className={cn(
                    'absolute border-2 bg-blue-200/30 cursor-move',
                    box.id === selectedMapping?.id
                      ? 'border-blue-600'
                      : 'border-red-400'
                  )}
                  style={{
                    left: displayBox.x,
                    top: displayBox.y,
                    width: displayBox.w,
                    height: displayBox.h,
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
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}