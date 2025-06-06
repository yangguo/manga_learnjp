'use client'

import { useState, useEffect, useRef } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Eye } from 'lucide-react'

interface PanelImageViewerProps {
  panelImageData: string
  originalImageData?: string
  panelPosition?: {
    x: number
    y: number
    width: number
    height: number
  }
  originalImageDimensions?: {
    width: number
    height: number
  }
  panelNumber: number
  readingOrderPosition: number
}

export default function PanelImageViewer({
  panelImageData,
  originalImageData,
  panelPosition,
  originalImageDimensions,
  panelNumber,
  readingOrderPosition
}: PanelImageViewerProps) {
  const [viewMode, setViewMode] = useState<'panel' | 'context'>('panel')
  const [zoom, setZoom] = useState(1)
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Calculate optimal initial zoom based on panel size
  const calculateOptimalZoom = () => {
    if (!panelPosition) return 2 // Default zoom for better readability
    
    // For very small panels (< 150px in either dimension), zoom more
    const minDimension = Math.min(panelPosition.width, panelPosition.height)
    const maxDimension = Math.max(panelPosition.width, panelPosition.height)
    
    if (minDimension < 100) return 4
    if (minDimension < 150) return 3
    if (maxDimension < 300) return 2.5
    return 2 // Default zoom for better visibility
  }

  // Set initial zoom when panel changes
  useEffect(() => {
    const optimalZoom = calculateOptimalZoom()
    setZoom(optimalZoom)
    setPanPosition({ x: 0, y: 0 })
    
    // Auto-suggest context view for very small panels if original image is available
    if (originalImageData && panelPosition) {
      const panelArea = panelPosition.width * panelPosition.height
      const avgDimension = Math.sqrt(panelArea)
      if (avgDimension < 120) {
        // For very small panels, start with context view to show location
        setViewMode('context')
      } else {
        setViewMode('panel')
      }
    }
  }, [panelPosition, panelNumber, originalImageData])

  const resetView = () => {
    const optimalZoom = calculateOptimalZoom()
    setZoom(optimalZoom)
    setPanPosition({ x: 0, y: 0 })
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)))
  }

  useEffect(() => {
    const handleMouseUpGlobal = () => setIsDragging(false)
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUpGlobal)
      return () => document.removeEventListener('mouseup', handleMouseUpGlobal)
    }
  }, [isDragging])

  const calculatePanelOverlay = () => {
    if (!panelPosition || !originalImageDimensions || !imageRef.current) {
      return null
    }

    const img = imageRef.current
    const containerRect = img.getBoundingClientRect()
    
    // Calculate the actual displayed image dimensions
    const imgNaturalRatio = img.naturalWidth / img.naturalHeight
    const containerRatio = containerRect.width / containerRect.height
    
    let displayedWidth, displayedHeight, offsetX, offsetY
    
    if (imgNaturalRatio > containerRatio) {
      // Image is wider than container
      displayedWidth = containerRect.width
      displayedHeight = containerRect.width / imgNaturalRatio
      offsetX = 0
      offsetY = (containerRect.height - displayedHeight) / 2
    } else {
      // Image is taller than container
      displayedWidth = containerRect.height * imgNaturalRatio
      displayedHeight = containerRect.height
      offsetX = (containerRect.width - displayedWidth) / 2
      offsetY = 0
    }

    // Scale panel position to displayed image coordinates
    const scaleX = displayedWidth / originalImageDimensions.width
    const scaleY = displayedHeight / originalImageDimensions.height
    
    const overlayX = offsetX + (panelPosition.x * scaleX)
    const overlayY = offsetY + (panelPosition.y * scaleY)
    const overlayWidth = panelPosition.width * scaleX
    const overlayHeight = panelPosition.height * scaleY

    return {
      left: overlayX,
      top: overlayY,
      width: overlayWidth,
      height: overlayHeight
    }
  }

  const overlayStyle = viewMode === 'context' ? calculatePanelOverlay() : null

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('panel')}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'panel'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Eye size={16} className="mr-1" />
            Panel View
          </button>
          {originalImageData && (
            <button
              onClick={() => setViewMode('context')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'context'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Maximize2 size={16} className="mr-1" />
              Context View
            </button>
          )}
          {panelPosition && panelPosition.width * panelPosition.height < 10000 && originalImageData && (
            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
              💡 Try Context View for small panels
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-600 hover:text-blue-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-sm text-gray-600 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-600 hover:text-blue-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={resetView}
            className="p-2 text-gray-600 hover:text-blue-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            title={`Reset to optimal zoom (${Math.round(calculateOptimalZoom() * 100)}%)`}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Image Viewer */}
      <div
        ref={containerRef}
        className="relative bg-gray-50 border border-gray-200 rounded-lg overflow-hidden"
        style={{ height: '600px' }} // Increased from 400px for better visibility
        onWheel={handleWheel}
      >
        <div
          className={`relative w-full h-full ${zoom > 1 ? 'cursor-grab' : ''} ${isDragging ? 'cursor-grabbing' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            transform: `scale(${zoom}) translate(${panPosition.x / zoom}px, ${panPosition.y / zoom}px)`,
            transformOrigin: 'center center'
          }}
        >
          <img
            ref={imageRef}
            src={`data:image/${viewMode === 'panel' ? 'png' : 'jpeg'};base64,${viewMode === 'panel' ? panelImageData : originalImageData}`}
            alt={`Panel ${panelNumber} ${viewMode === 'panel' ? 'image' : 'in context'}`}
            className="w-full h-full object-contain"
            style={{
              imageRendering: zoom > 2 ? 'crisp-edges' : 'auto'
            }}
            draggable={false}
          />

          {/* Panel overlay for context view */}
          {viewMode === 'context' && overlayStyle && (
            <div
              className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20"
              style={{
                left: `${overlayStyle.left}px`,
                top: `${overlayStyle.top}px`,
                width: `${overlayStyle.width}px`,
                height: `${overlayStyle.height}px`,
                pointerEvents: 'none'
              }}
            >
              <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded">
                Panel {panelNumber} (#{readingOrderPosition})
              </div>
            </div>
          )}
        </div>

        {/* Zoom indicator */}
        {zoom !== calculateOptimalZoom() && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
            {Math.round(zoom * 100)}% {zoom < calculateOptimalZoom() ? '(Zoomed out)' : '(Zoomed in)'}
          </div>
        )}

        {/* Instructions */}
        {zoom > 1 && (
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
            Click and drag to pan • Scroll to zoom
            {zoom === calculateOptimalZoom() && zoom > 1 && (
              <div className="text-yellow-300 mt-1">✨ Auto-zoomed for readability</div>
            )}
          </div>
        )}
      </div>

      {/* Panel Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="font-medium text-blue-800">Panel Number</div>
          <div className="text-blue-600 text-lg font-bold">{panelNumber}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="font-medium text-green-800">Reading Order</div>
          <div className="text-green-600 text-lg font-bold">#{readingOrderPosition}</div>
        </div>
        {panelPosition && (
          <>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
              <div className="font-medium text-purple-800">Position</div>
              <div className="text-purple-600 font-mono text-sm">({panelPosition.x}, {panelPosition.y})</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <div className="font-medium text-orange-800">Dimensions</div>
              <div className="text-orange-600 font-mono text-sm">{panelPosition.width}×{panelPosition.height}</div>
              {panelPosition.width * panelPosition.height < 15000 && (
                <div className="text-xs text-orange-500 mt-1">Small panel - Auto-zoomed</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
