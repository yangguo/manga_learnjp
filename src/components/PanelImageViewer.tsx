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
  isSimpleAnalysisMode?: boolean
}

export default function PanelImageViewer({
  panelImageData,
  originalImageData,
  panelPosition,
  originalImageDimensions,
  panelNumber,
  readingOrderPosition,
  isSimpleAnalysisMode = false
}: PanelImageViewerProps) {
  const [viewMode, setViewMode] = useState<'panel' | 'context'>('panel')
  const [zoom, setZoom] = useState(1)
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Calculate optimal initial zoom based on panel size and container
  const calculateOptimalZoom = () => {
    if (!panelPosition || !containerRef.current) return 1 // Start at 1x for natural size
    
    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    
    // Calculate zoom to fit the panel nicely in the container
    const scaleX = (containerWidth * 0.8) / panelPosition.width
    const scaleY = (containerHeight * 0.8) / panelPosition.height
    const fitZoom = Math.min(scaleX, scaleY)
    
    // For very small panels, allow more zoom but cap it reasonably
    const minDimension = Math.min(panelPosition.width, panelPosition.height)
    if (minDimension < 100) return Math.min(fitZoom, 3)
    if (minDimension < 150) return Math.min(fitZoom, 2)
    
    // For normal panels, use fit zoom but don't go below 1x or above 2x
    return Math.max(1, Math.min(fitZoom, 2))
  }

  // Calculate optimal positioning for context view to center on panel
  const calculateContextViewPosition = () => {
    if (!panelPosition || !originalImageDimensions || !containerRef.current) {
      return { zoom: 1, panPosition: { x: 0, y: 0 } }
    }

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Calculate how the image will be displayed with object-contain
    const imageAspectRatio = originalImageDimensions.width / originalImageDimensions.height
    const containerAspectRatio = containerWidth / containerHeight
    
    let displayedWidth, displayedHeight
    if (imageAspectRatio > containerAspectRatio) {
      // Image is wider than container
      displayedWidth = containerWidth
      displayedHeight = containerWidth / imageAspectRatio
    } else {
      // Image is taller than container
      displayedWidth = containerHeight * imageAspectRatio
      displayedHeight = containerHeight
    }

    // Calculate zoom to show panel at a reasonable size
    const panelDisplayWidth = (panelPosition.width / originalImageDimensions.width) * displayedWidth
    const panelDisplayHeight = (panelPosition.height / originalImageDimensions.height) * displayedHeight
    
    // In simple analysis mode, make the detected content larger (60% of view)
    // In manga mode, use smaller size (40% of view) to show more context
    const targetPanelPercentage = isSimpleAnalysisMode ? 0.6 : 0.4
    const targetPanelSize = Math.min(containerWidth, containerHeight) * targetPanelPercentage
    const scaleFactorX = targetPanelSize / panelDisplayWidth
    const scaleFactorY = targetPanelSize / panelDisplayHeight
    // In simple analysis mode, allow higher zoom levels for better content visibility
    const maxZoom = isSimpleAnalysisMode ? 6 : 4
    const contextZoom = Math.min(scaleFactorX, scaleFactorY, maxZoom)
    
    // Calculate panel center in displayed image coordinates
    const panelCenterX = (panelPosition.x + panelPosition.width / 2) / originalImageDimensions.width
    const panelCenterY = (panelPosition.y + panelPosition.height / 2) / originalImageDimensions.height
    
    // Calculate pan to center the panel in the container
    const panX = -(panelCenterX - 0.5) * displayedWidth * contextZoom
    const panY = -(panelCenterY - 0.5) * displayedHeight * contextZoom

    return {
      zoom: Math.max(isSimpleAnalysisMode ? 1.5 : 1, contextZoom), // Minimum 1.5x zoom in simple analysis mode
      panPosition: { x: panX, y: panY }
    }
  }

  // Set initial zoom when panel changes
  useEffect(() => {
    if (viewMode === 'panel') {
      const optimalZoom = calculateOptimalZoom()
      setZoom(optimalZoom)
      setPanPosition({ x: 0, y: 0 })
    } else if (viewMode === 'context') {
      const contextView = calculateContextViewPosition()
      setZoom(contextView.zoom)
      setPanPosition(contextView.panPosition)
    }
    
    // In simple analysis mode, default to context view to show panel location
    if (isSimpleAnalysisMode && originalImageData && panelPosition) {
      setViewMode('context')
      return
    }
    
    // Auto-suggest context view for very small panels if original image is available
    if (originalImageData && panelPosition) {
      const panelArea = panelPosition.width * panelPosition.height
      const avgDimension = Math.sqrt(panelArea)
      if (avgDimension < 80) {
        // For very small panels, start with context view to show location
        setViewMode('context')
      } else {
        setViewMode('panel')
      }
    }
  }, [panelPosition, panelNumber, originalImageData, viewMode, isSimpleAnalysisMode])

  const handleViewModeChange = (newMode: 'panel' | 'context') => {
    setViewMode(newMode)
    
    if (newMode === 'panel') {
      const optimalZoom = calculateOptimalZoom()
      setZoom(optimalZoom)
      setPanPosition({ x: 0, y: 0 })
    } else if (newMode === 'context') {
      const contextView = calculateContextViewPosition()
      setZoom(contextView.zoom)
      setPanPosition(contextView.panPosition)
    }
  }

  const resetView = () => {
    if (viewMode === 'panel') {
      const optimalZoom = calculateOptimalZoom()
      setZoom(optimalZoom)
      setPanPosition({ x: 0, y: 0 })
    } else if (viewMode === 'context') {
      const contextView = calculateContextViewPosition()
      setZoom(contextView.zoom)
      setPanPosition(contextView.panPosition)
    }
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
      const container = containerRef.current
      if (!container) return
      
      const rect = container.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      
      // Calculate new position relative to container center
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      
      // Constrain panning to keep image visible
      const maxPanX = rect.width * (zoom - 1) / 2
      const maxPanY = rect.height * (zoom - 1) / 2
      
      setPanPosition({
        x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, newY))
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.1, Math.min(5, zoom * delta))
    
    // When zooming, keep the image centered
    if (newZoom <= 1) {
      setPanPosition({ x: 0, y: 0 })
    }
    
    setZoom(newZoom)
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
            onClick={() => handleViewModeChange('panel')}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'panel'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Eye size={16} className="mr-1" />
            {isSimpleAnalysisMode ? 'Content View' : 'Panel View'}
          </button>
          {originalImageData && (
            <button
              onClick={() => handleViewModeChange('context')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'context'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Maximize2 size={16} className="mr-1" />
              {isSimpleAnalysisMode ? 'Full Image View' : 'Context View'}
            </button>
          )}
          {isSimpleAnalysisMode && originalImageData && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
              🎯 Detected content within your image - Enhanced zoom enabled
            </span>
          )}
          {!isSimpleAnalysisMode && panelPosition && panelPosition.width * panelPosition.height < 10000 && originalImageData && (
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
            title={`Reset to optimal view for ${viewMode} mode`}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Image Viewer */}
      <div
        ref={containerRef}
        className="relative bg-gray-50 border border-gray-200 rounded-lg overflow-hidden flex items-center justify-center"
        style={{ height: '500px' }} // Reduced from 600px for better proportions
        onWheel={handleWheel}
      >
        <div
          className={`relative ${zoom > 1 ? 'cursor-grab' : ''} ${isDragging ? 'cursor-grabbing' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            transform: `scale(${zoom}) translate(${panPosition.x / zoom}px, ${panPosition.y / zoom}px)`,
            transformOrigin: 'center center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%'
          }}
        >
          <img
            ref={imageRef}
            src={`data:image/${viewMode === 'panel' ? 'png' : 'jpeg'};base64,${viewMode === 'panel' ? panelImageData : originalImageData}`}
            alt={`Panel ${panelNumber} ${viewMode === 'panel' ? 'image' : 'in context'}`}
            className="max-w-full max-h-full object-contain"
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
                {isSimpleAnalysisMode ? 'Detected Content' : `Panel ${panelNumber} (#{readingOrderPosition})`}
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
            {viewMode === 'context' && isSimpleAnalysisMode && (
              <div className="text-yellow-300 mt-1">🎯 Showing detected content in your image</div>
            )}
            {viewMode === 'context' && !isSimpleAnalysisMode && (
              <div className="text-yellow-300 mt-1">🎯 Centered on Panel {panelNumber}</div>
            )}
            {viewMode === 'panel' && zoom === calculateOptimalZoom() && zoom > 1 && (
              <div className="text-yellow-300 mt-1">✨ Auto-fitted for optimal viewing</div>
            )}
          </div>
        )}
      </div>

      {/* Panel Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="font-medium text-blue-800">{isSimpleAnalysisMode ? 'Content Number' : 'Panel Number'}</div>
          <div className="text-blue-600 text-lg font-bold">{panelNumber}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="font-medium text-green-800">{isSimpleAnalysisMode ? 'Detection Order' : 'Reading Order'}</div>
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
              {panelPosition.width * panelPosition.height < 10000 && (
                <div className="text-xs text-orange-500 mt-1">{isSimpleAnalysisMode ? 'Small content - Auto-fitted' : 'Small panel - Auto-fitted'}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
