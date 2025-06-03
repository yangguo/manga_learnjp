/**
 * Client-Side Panel Segmentation Demo Component
 * Demonstrates the new browser-based panel segmentation functionality
 */

'use client'

import React, { useState, useCallback } from 'react'
import { useClientPanelSegmentation } from '@/hooks/useClientPanelSegmentation'
import type { PanelSegmentationResult } from '@/lib/types'

interface ClientPanelSegmentationDemoProps {
  imageBase64?: string
  onSegmentationComplete?: (result: PanelSegmentationResult) => void
}

export function ClientPanelSegmentationDemo({ 
  imageBase64, 
  onSegmentationComplete 
}: ClientPanelSegmentationDemoProps) {
  const [result, setResult] = useState<PanelSegmentationResult | null>(null)
  const [selectedPanel, setSelectedPanel] = useState<number | null>(null)
  const { segmentPanels, isLoading, error, isAvailable, progress } = useClientPanelSegmentation()

  const handleSegmentation = useCallback(async () => {
    if (!imageBase64) {
      alert('Please upload an image first')
      return
    }

    try {
      const segmentationResult = await segmentPanels(imageBase64)
      setResult(segmentationResult)
      onSegmentationComplete?.(segmentationResult)
    } catch (err) {
      console.error('Segmentation failed:', err)
    }
  }, [imageBase64, segmentPanels, onSegmentationComplete])

  const handlePanelClick = (panelIndex: number) => {
    setSelectedPanel(selectedPanel === panelIndex ? null : panelIndex)
  }

  if (!isAvailable) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Client-Side Segmentation Unavailable
            </h3>
            <p className="mt-1 text-sm text-yellow-700">
              OpenCV.js is not available in this environment. This feature works best in modern browsers.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">
              🌐 Client-Side Panel Segmentation
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              Advanced browser-based panel detection using OpenCV.js
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✅ Available
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handleSegmentation}
          disabled={!imageBase64 || isLoading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Segment Panels
            </>
          )}
        </button>

        {result && (
          <div className="text-sm text-gray-600">
            Found <span className="font-semibold text-indigo-600">{result.totalPanels}</span> panels
          </div>
        )}
      </div>

      {/* Progress */}
      {progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center">
            <svg className="animate-spin h-4 w-4 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-blue-700">{progress}</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Segmentation Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && result.panels.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              Segmentation Results
            </h4>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{result.totalPanels}</div>
                <div className="text-sm text-gray-500">Total Panels</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{result.originalImage.width}×{result.originalImage.height}</div>
                <div className="text-sm text-gray-500">Original Size</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{result.readingOrder.join('→')}</div>
                <div className="text-sm text-gray-500">Reading Order</div>
              </div>
            </div>

            {/* Panel Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {result.panels.map((panel, index) => (
                <div
                  key={panel.id}
                  className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
                    selectedPanel === index
                      ? 'border-indigo-500 shadow-lg scale-105'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                  onClick={() => handlePanelClick(index)}
                >
                  <img
                    src={`data:image/jpeg;base64,${panel.imageData}`}
                    alt={`Panel ${index + 1}`}
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                    Panel {index + 1}
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                    {panel.boundingBox.width}×{panel.boundingBox.height}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Panel Details */}
            {selectedPanel !== null && result.panels[selectedPanel] && (
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-3">
                  Panel {selectedPanel + 1} Details
                </h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Position:</span>
                    <span className="ml-2 text-gray-600">
                      ({result.panels[selectedPanel].boundingBox.x}, {result.panels[selectedPanel].boundingBox.y})
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Size:</span>
                    <span className="ml-2 text-gray-600">
                      {result.panels[selectedPanel].boundingBox.width} × {result.panels[selectedPanel].boundingBox.height}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Reading Order:</span>
                    <span className="ml-2 text-gray-600">
                      #{result.panels[selectedPanel].readingOrderIndex + 1}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Panel ID:</span>
                    <span className="ml-2 text-gray-600 font-mono text-xs">
                      {result.panels[selectedPanel].id}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              About Client-Side Panel Segmentation
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Runs entirely in your browser using OpenCV.js</li>
                <li>Works on Vercel and other serverless platforms</li>
                <li>No Python dependencies required</li>
                <li>Uses advanced computer vision algorithms for panel detection</li>
                <li>Supports both contour-based and line-based detection methods</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}