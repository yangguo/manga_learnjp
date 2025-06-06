'use client'

import { useState, useEffect } from 'react'
import { Copy, ChevronRight, ChevronDown } from 'lucide-react'
import PanelImageViewer from './PanelImageViewer'
import type { MangaAnalysisResult, MangaPanel, WordAnalysis, GrammarPattern } from '@/lib/types'

interface MangaAnalyzerProps {
  analysisResult: MangaAnalysisResult
  selectedPanelId?: number | null
  originalImageData?: string // base64 encoded original image
}

export default function MangaAnalyzer({ analysisResult, selectedPanelId, originalImageData }: MangaAnalyzerProps) {
  const [expandedPanels, setExpandedPanels] = useState<Set<number>>(new Set([1]))
  const [showOriginalLayout, setShowOriginalLayout] = useState(true)

  // Auto-expand the selected panel when selectedPanelId changes
  useEffect(() => {
    if (selectedPanelId !== null && selectedPanelId !== undefined) {
      setExpandedPanels(prev => {
        const newSet = new Set(prev)
        newSet.add(selectedPanelId)
        return newSet
      })
    }
  }, [selectedPanelId])

  const togglePanel = (panelNumber: number) => {
    const newExpanded = new Set(expandedPanels)
    if (newExpanded.has(panelNumber)) {
      newExpanded.delete(panelNumber)
    } else {
      newExpanded.add(panelNumber)
    }
    setExpandedPanels(newExpanded)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-50 border-green-200'
      case 'intermediate': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'advanced': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  // Sort panels by reading order (panel numbers now match reading order positions)
  const sortedPanels = [...analysisResult.panels].sort((a, b) => a.panelNumber - b.panelNumber)

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            📚 {analysisResult.panels.length > 1 ? 'Manga Page Summary' : 'Image Analysis Summary'}
          </h2>
          <button
            onClick={() => copyToClipboard(analysisResult.overallSummary)}
            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            title="Copy summary"
          >
            <Copy size={16} />
          </button>
        </div>
        <p className="text-gray-800 leading-relaxed">{analysisResult.overallSummary}</p>
        
        {/* Reading Order Info - only show for multiple panels */}
        {analysisResult.panels.length > 1 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Reading Order:</strong> {analysisResult.readingOrder.join(' → ')} 
              <span className="text-blue-600 ml-2">(Right to Left, Top to Bottom)</span>
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Panels have been automatically segmented and ordered using AI analysis
            </p>
          </div>
        )}

        {/* Single panel info */}
        {analysisResult.panels.length === 1 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Analysis Mode:</strong> Single panel detected - displaying detailed text analysis
            </p>
            <p className="text-xs text-green-600 mt-1">
              AI analysis detected one main content area for detailed text analysis
            </p>
          </div>
        )}

        {/* Panel Layout Toggle - only show for multiple panels */}
        {analysisResult.panels.length > 1 && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">View Mode:</span>
            <button
              onClick={() => setShowOriginalLayout(!showOriginalLayout)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                showOriginalLayout 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showOriginalLayout ? 'Reading Sequence' : 'Original Layout'}
            </button>
          </div>
        )}
      </div>

      {/* Panel Analysis */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">
          {analysisResult.panels.length > 1 
            ? `Panel-by-Panel Analysis (${showOriginalLayout ? 'Reading Sequence' : 'Original Layout'})`
            : 'Detailed Text Analysis'
          }
        </h2>
        
        {sortedPanels.map((panel, sequenceIndex) => {
          const readingOrderPosition = panel.panelNumber // Panel number now matches reading order position
          
          return (
            <div 
              key={panel.panelNumber} 
              id={`panel-${panel.panelNumber}`}
              className={`bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${
                selectedPanelId === panel.panelNumber ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
              }`}
            >
              {/* Panel Header */}
              <button
                onClick={() => togglePanel(panel.panelNumber)}
                className="w-full px-6 py-4 text-left bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  {/* Panel Thumbnail */}
                  {panel.imageData && (
                    <div className="flex-shrink-0">
                      <img
                        src={`data:image/png;base64,${panel.imageData}`}
                        alt={`Panel ${panel.panelNumber} thumbnail`}
                        className="w-12 h-12 object-cover rounded border border-gray-300"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded-full">
                        {analysisResult.panels.length > 1 ? `Panel ${panel.panelNumber}` : 'Content'}
                      </span>
                      {analysisResult.panels.length > 1 && (
                        <span className="bg-green-600 text-white text-xs font-medium px-2 py-1 rounded-full">
                          #{readingOrderPosition}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-medium text-gray-900 text-left">
                        {panel.extractedText || 'No text detected'}
                      </h3>
                      {panel.position && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded mt-1 inline-block w-fit">
                          {panel.position.width}×{panel.position.height}px
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {expandedPanels.has(panel.panelNumber) ? (
                  <ChevronDown size={20} className="text-gray-400" />
                ) : (
                  <ChevronRight size={20} className="text-gray-400" />
                )}
              </button>

            {/* Panel Content */}
            {expandedPanels.has(panel.panelNumber) && (
              <div className="p-6 space-y-6">
                {/* Panel Analysis */}
                <div className="grid grid-cols-1 gap-6">
                  {/* Enhanced Panel Image Viewer */}
                  {panel.imageData && (
                    <div className="space-y-3">
                      <h4 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                        🖼️ {analysisResult.panels.length > 1 ? 'Panel Image' : 'Analyzed Image'}
                      </h4>
                      <PanelImageViewer
                        panelImageData={panel.imageData}
                        originalImageData={originalImageData}
                        panelPosition={panel.position}
                        originalImageDimensions={
                          analysisResult.panels.length > 1 ? {
                            width: Math.max(...analysisResult.panels.map(p => p.position.x + p.position.width)),
                            height: Math.max(...analysisResult.panels.map(p => p.position.y + p.position.height))
                          } : undefined
                        }
                        panelNumber={panel.panelNumber}
                        readingOrderPosition={readingOrderPosition}
                      />
                    </div>
                  )}
                </div>

                {/* Context and Text */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Extracted Text */}
                  {panel.extractedText && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                          📝 Extracted Text
                        </h4>
                        <button
                          onClick={() => copyToClipboard(panel.extractedText)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Copy text"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-blue-900 font-medium leading-relaxed text-lg">
                          {panel.extractedText}
                        </p>
                        {panel.translation && (
                          <p className="text-blue-700 mt-3 text-sm leading-relaxed">
                            <strong>Translation:</strong> {panel.translation}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Context */}
                  {panel.context && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                          🎭 {analysisResult.panels.length > 1 ? 'Panel Context' : 'Content Context'}
                        </h4>
                        <button
                          onClick={() => copyToClipboard(panel.context)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Copy context"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-green-800 leading-relaxed">{panel.context}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Vocabulary */}
                {panel.words && panel.words.length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                      📚 Vocabulary Analysis
                    </h4>
                    <div className="grid gap-3">
                      {panel.words.map((word: WordAnalysis, index: number) => (
                        <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xl font-bold text-gray-900">{word.word}</span>
                              <span className="text-gray-600">({word.reading})</span>
                              <span className={`text-xs px-2 py-1 rounded-full border ${getDifficultyColor(word.difficulty)}`}>
                                {word.difficulty}
                              </span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(`${word.word} (${word.reading}) - ${word.meaning}`)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Copy word"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          <p className="text-gray-700 mb-1">{word.meaning}</p>
                          <p className="text-sm text-gray-500 italic">{word.partOfSpeech}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grammar */}
                {panel.grammar && panel.grammar.length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
                      ⚙️ Grammar Patterns
                    </h4>
                    <div className="space-y-4">
                      {panel.grammar.map((pattern: GrammarPattern, index: number) => (
                        <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-gray-900">{pattern.pattern}</h5>
                            <button
                              onClick={() => copyToClipboard(`${pattern.pattern}: ${pattern.explanation}\nExample: ${pattern.example}`)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Copy grammar pattern"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                          <p className="text-gray-700 mb-2">{pattern.explanation}</p>
                          <div className="bg-gray-50 p-3 rounded border border-gray-200">
                            <p className="text-sm text-gray-600 font-medium">Example:</p>
                            <p className="text-gray-800">{pattern.example}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )})}
      </div>
    </div>
  )
}
