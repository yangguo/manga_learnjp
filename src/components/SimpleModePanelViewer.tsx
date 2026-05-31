'use client'

import { useEffect, useRef, useState } from 'react'
import { MangaAnalysisResult, MangaPanel } from '@/lib/types'
import { X } from 'lucide-react'

interface SimpleModePanelViewerProps {
  result: MangaAnalysisResult
  originalImageData?: string | null
}

const formatImageSrc = (data?: string | null, fallbackMime = 'png') => {
  if (!data) return null
  return data.startsWith('data:') ? data : `data:image/${fallbackMime};base64,${data}`
}

interface PanelDetailModalProps {
  panel: MangaPanel | null
  isOpen: boolean
  onClose: () => void
}

function PanelDetailModal({ panel, isOpen, onClose }: PanelDetailModalProps) {
  if (!isOpen || !panel) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-md">
        <div className="flex items-start justify-between p-4 border-b border-white/10">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Panel {panel.panelNumber}</p>
            <h2 className="text-xl font-semibold text-white">Detailed Explanation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            aria-label="Close panel details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {panel.extractedText && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Extracted Text</h3>
              <p className="bg-blue-500/10 border border-blue-500/30 text-blue-200 p-3 rounded-lg font-japanese leading-relaxed">
                {panel.extractedText}
              </p>
            </div>
          )}

          {panel.translation && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Translation</h3>
              <p className="bg-green-500/10 border border-green-500/30 text-green-200 p-3 rounded-lg leading-relaxed">
                {panel.translation}
              </p>
            </div>
          )}

          {panel.context && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">Context</h3>
              <p className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-3 rounded-lg leading-relaxed">
                {panel.context}
              </p>
            </div>
          )}

          {panel.sentences && panel.sentences.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Sentence Breakdown</h3>
              <div className="space-y-3">
                {panel.sentences.map((sentence, index) => (
                  <div key={index} className="p-3 border border-white/10 rounded-lg bg-white/5">
                    <div className="flex items-start gap-3">
                      <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-full font-semibold">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-1">
                        <p className="text-white font-japanese font-semibold">{sentence.sentence}</p>
                        <p className="text-gray-300">{sentence.translation}</p>
                        {sentence.context && (
                          <p className="text-xs text-gray-500">{sentence.context}</p>
                        )}
                      </div>
                    </div>

                    {sentence.words && sentence.words.length > 0 && (
                      <div className="mt-3 p-3 bg-white/5 rounded-lg border border-blue-500/20">
                        <p className="text-sm font-medium text-blue-300 mb-2">Vocabulary</p>
                        <div className="grid gap-2">
                          {sentence.words.map((word, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded border border-white/10 bg-blue-500/10 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white font-japanese">{word.word}</span>
                                <span className="text-gray-400 font-japanese">({word.reading})</span>
                                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                                  {word.difficulty}
                                </span>
                              </div>
                              <p className="text-gray-300 mt-1">{word.meaning}</p>
                              {word.partOfSpeech && (
                                <p className="text-[11px] text-gray-500">Part of speech: {word.partOfSpeech}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {sentence.grammar && sentence.grammar.length > 0 && (
                      <div className="mt-3 p-3 bg-white/5 rounded-lg border border-purple-500/20">
                        <p className="text-sm font-medium text-purple-300 mb-2">Grammar</p>
                        <div className="grid gap-2">
                          {sentence.grammar.map((grammar, idx) => (
                            <div key={idx} className="p-2 rounded border border-purple-500/30 bg-purple-500/10 text-sm">
                              <p className="font-semibold text-purple-300">{grammar.pattern}</p>
                              <p className="text-gray-300">{grammar.explanation}</p>
                              {grammar.example && (
                                <p className="text-purple-400 text-xs mt-1">Example: {grammar.example}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SimpleModePanelViewer({ result, originalImageData }: SimpleModePanelViewerProps) {
  const [selectedPanel, setSelectedPanel] = useState<MangaPanel | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageSize, setImageSize] = useState({
    width: 0,
    height: 0,
    naturalWidth: 0,
    naturalHeight: 0
  })

  const originalImageSrc = formatImageSrc(originalImageData, 'jpeg')

  useEffect(() => {
    const updateImageSize = () => {
      if (imageRef.current) {
        setImageSize({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight,
          naturalWidth: imageRef.current.naturalWidth || imageRef.current.clientWidth,
          naturalHeight: imageRef.current.naturalHeight || imageRef.current.clientHeight
        })
      }
    }

    const img = imageRef.current
    if (img) {
      if (img.complete) {
        updateImageSize()
      } else {
        img.onload = updateImageSize
      }
    }

    window.addEventListener('resize', updateImageSize)
    return () => window.removeEventListener('resize', updateImageSize)
  }, [originalImageSrc])

  const sortedPanels = [...result.panels].sort((a, b) => a.panelNumber - b.panelNumber)
  const detectionSpace = sortedPanels.reduce(
    (acc, panel) => {
      const x = panel.position?.x ?? 0
      const y = panel.position?.y ?? 0
      const width = panel.position?.width ?? 0
      const height = panel.position?.height ?? 0
      return {
        width: Math.max(acc.width, x + width),
        height: Math.max(acc.height, y + height)
      }
    },
    { width: 0, height: 0 }
  )

  const normalizeToPixels = (
    value: number | undefined | null,
    renderedDimension: number,
    baseDimension: number
  ) => {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || renderedDimension === 0) {
      return null
    }

    // Already normalized 0-1
    if (value >= 0 && value <= 1) {
      return value * renderedDimension
    }

    // Percentage 0-100
    if (value > 1 && value <= 100) {
      return (value / 100) * renderedDimension
    }

    // Pixel values relative to detected space
    const safeBase = baseDimension || renderedDimension
    return (value / safeBase) * renderedDimension
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Simple Mode Overview</h2>
        <p className="text-gray-700 leading-relaxed">{result.overallSummary}</p>
        <p className="text-sm text-gray-500 mt-2">
          Click any highlighted rectangle to pop out the full explanation for that detected area.
        </p>
      </div>

      {originalImageSrc ? (
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr] items-start">
          <div className="relative w-full bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            <img
              ref={imageRef}
              src={originalImageSrc}
              alt="Analyzed page with detected panels"
              className="w-full h-auto"
            />

            {sortedPanels.map((panel, index) => {
              const { position } = panel
              const baseWidth = detectionSpace.width || imageSize.naturalWidth || imageSize.width
              const baseHeight = detectionSpace.height || imageSize.naturalHeight || imageSize.height

              const left = normalizeToPixels(position?.x, imageSize.width, baseWidth)
              const top = normalizeToPixels(position?.y, imageSize.height, baseHeight)
              const rawWidth = normalizeToPixels(position?.width, imageSize.width, baseWidth)
              const rawHeight = normalizeToPixels(position?.height, imageSize.height, baseHeight)

              if (
                left === null ||
                top === null ||
                rawWidth === null ||
                rawHeight === null ||
                rawWidth <= 0 ||
                rawHeight <= 0
              ) {
                return null
              }

              const maxWidth = Math.max(imageSize.width - left, 0)
              const maxHeight = Math.max(imageSize.height - top, 0)
              const width = Math.min(rawWidth, maxWidth)
              const height = Math.min(rawHeight, maxHeight)

              return (
                <button
                  key={panel.panelNumber}
                  className="group absolute border-2 border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 transition-all"
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${width}px`,
                    height: `${height}px`
                  }}
                  onClick={() => setSelectedPanel(panel)}
                  title={`Open details for panel ${panel.panelNumber}`}
                >
                  <span className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    {index + 1}
                  </span>
                  <div className="pointer-events-none absolute left-0 top-full mt-1 hidden min-w-[180px] max-w-[220px] rounded border border-gray-200 bg-white/90 px-2 py-1 text-[11px] leading-snug text-gray-900 shadow-lg group-hover:block">
                    <p className="font-semibold text-xs">Preview</p>
                    <p className="line-clamp-3">{panel.translation || panel.extractedText || 'No text detected'}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Detected Panels</h3>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full border border-blue-200">
                {sortedPanels.length} total
              </span>
            </div>
            <div className="grid gap-2">
              {sortedPanels.map(panel => (
                <button
                  key={panel.panelNumber}
                  onClick={() => setSelectedPanel(panel)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">{panel.panelNumber}</span>
                    <div className="flex-1">
                      <p className="text-gray-900 font-medium">
                        {panel.extractedText || 'No text detected'}
                      </p>
                      {panel.translation && (
                        <p className="text-gray-600 text-sm line-clamp-2">{panel.translation}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg p-4">
          Original image unavailable. Re-run analysis to view inline rectangles.
        </div>
      )}

      <PanelDetailModal panel={selectedPanel} isOpen={!!selectedPanel} onClose={() => setSelectedPanel(null)} />
    </div>
  )
}
