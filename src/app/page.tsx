'use client'

import { useState } from 'react'
import ImageUploader from '@/components/ImageUploader'
import TextAnalyzer from '@/components/TextAnalyzer'
import MangaAnalyzer from '@/components/MangaAnalyzer'
import Header from '@/components/Header'
import DemoSection from '@/components/DemoSection'
import { ClientPanelSegmentationDemo } from '@/components/ClientPanelSegmentationDemo'
import { motion, AnimatePresence } from 'framer-motion'
import { AnalysisResult, MangaAnalysisResult } from '@/lib/types'
import { AlertCircle, X, BookOpen, FileText } from 'lucide-react'

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [mangaAnalysisResult, setMangaAnalysisResult] = useState<MangaAnalysisResult | null>(null)
  const [originalImageData, setOriginalImageData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isMangaMode, setIsMangaMode] = useState(true)
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null)

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result)
    setMangaAnalysisResult(null)
    setOriginalImageData(null) // Clear original image data for simple analysis
    setError(null) // Clear any previous errors
    setSelectedPanelId(null)
  }

  const handleMangaAnalysisComplete = (result: MangaAnalysisResult) => {
    setMangaAnalysisResult(result)
    setAnalysisResult(null)
    setError(null) // Clear any previous errors
    setSelectedPanelId(null)
  }

  const handleOriginalImageChange = (imageData: string | null) => {
    setOriginalImageData(imageData)
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    setAnalysisResult(null) // Clear any previous results
    setMangaAnalysisResult(null)
    setOriginalImageData(null) // Clear original image data on error
    setSelectedPanelId(null)
  }

  const clearError = () => {
    setError(null)
  }

  const toggleMode = () => {
    setIsMangaMode(!isMangaMode)
    setAnalysisResult(null)
    setMangaAnalysisResult(null)
    setError(null)
    setSelectedPanelId(null)
  }

  const scrollToPanelAnalysis = (panelNumber: number) => {
    setSelectedPanelId(panelNumber)
    // Scroll to the panel analysis section after a brief delay
    setTimeout(() => {
      const element = document.getElementById(`panel-${panelNumber}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            Learn Japanese Through Manga
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Upload manga pages and let AI extract and analyze Japanese text with detailed explanations
          </p>
          
          {/* Mode Toggle */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleMode}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${
                isMangaMode
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <BookOpen size={20} />
              Panel Analysis
            </button>
            <button
              onClick={toggleMode}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${
                !isMangaMode
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FileText size={20} />
              Simple Analysis
            </button>
          </div>
          
          <p className="text-sm text-gray-500 mt-4">
            {isMangaMode
              ? 'Extract text from individual manga panels using computer vision and AI analysis'
              : 'Automatically detect panels with AI, or fallback to simple text extraction'
            }
          </p>
        </motion.div>

        <div className="space-y-8 max-w-7xl mx-auto">
          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-lg backdrop-blur-md">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-red-800 mb-1">
                        Analysis Failed
                      </h3>
                      <div className="text-sm text-red-700 whitespace-pre-line">
                        {error}
                      </div>
                    </div>
                    <button
                      onClick={clearError}
                      className="flex-shrink-0 p-1 hover:bg-red-100 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <ImageUploader 
              onAnalysisComplete={handleAnalysisComplete}
              onMangaAnalysisComplete={handleMangaAnalysisComplete}
              onOriginalImageChange={handleOriginalImageChange}
              onError={handleError}
              isMangaMode={isMangaMode}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {mangaAnalysisResult ? (
              // Show panel analysis results (for both manga mode and simple mode with panel detection)
              <div className="space-y-8">
                {/* Panel Overview Grid */}
                {mangaAnalysisResult.panels.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5 }}
                    className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
                  >
                    <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      🎬 Panel Overview
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {mangaAnalysisResult.panels
                        .sort((a, b) => a.panelNumber - b.panelNumber) // Sort by panel number (which now matches reading order)
                        .map((panel) => {
                          return (
                            <div key={panel.panelNumber} className="relative group">
                              {panel.imageData ? (
                                <button
                                  onClick={() => scrollToPanelAnalysis(panel.panelNumber)}
                                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 hover:shadow-md hover:border-blue-300 transition-all transform hover:scale-105"
                                >
                                  <img
                                    src={`data:image/png;base64,${panel.imageData}`}
                                    alt={`Panel ${panel.panelNumber}`}
                                    className="w-full h-24 object-cover rounded border border-gray-200"
                                  />
                                  <div className="mt-2 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded">
                                        Panel {panel.panelNumber}
                                      </span>
                                      <span className="bg-green-600 text-white text-xs font-medium px-2 py-1 rounded">
                                        #{panel.panelNumber}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-600 truncate" title={panel.extractedText}>
                                      {panel.extractedText || 'No text detected'}
                                    </p>
                                    {panel.position && (
                                      <p className="text-xs text-gray-500">
                                        {panel.position.width}×{panel.position.height}px
                                      </p>
                                    )}
                                  </div>
                                  <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-10 rounded-lg transition-opacity pointer-events-none"></div>
                                </button>
                              ) : (
                                <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 h-32 flex items-center justify-center">
                                  <span className="text-sm text-gray-500">No image data</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                    <p className="text-sm text-gray-500 mt-4">
                      💡 Click on any panel above to jump to its detailed analysis below
                    </p>
                  </motion.div>
                )}
                
                {/* Detailed Analysis */}
                <MangaAnalyzer 
                  analysisResult={mangaAnalysisResult} 
                  selectedPanelId={selectedPanelId}
                  originalImageData={originalImageData || undefined}
                />
              </div>
            ) : analysisResult ? (
              // Show simple text analysis results (fallback when panel detection fails)
              <TextAnalyzer analysisResult={analysisResult} />
            ) : null}
          </motion.div>
        </div>

        <DemoSection />
        
        {/* Client-Side Panel Segmentation Demo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12"
        >
          <ClientPanelSegmentationDemo />
        </motion.div>
      </main>
    </div>
  )
}
