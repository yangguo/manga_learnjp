'use client'

import { useState } from 'react'
import ImageUploader from '@/components/ImageUploader'
import TextAnalyzer from '@/components/TextAnalyzer'
import MangaAnalyzer from '@/components/MangaAnalyzer'
import ReadingModeViewer from '@/components/ReadingModeViewer'
import SimpleModePanelViewer from '@/components/SimpleModePanelViewer'
import Header from '@/components/Header'
import { motion, AnimatePresence } from 'framer-motion'
import { AnalysisResult, MangaAnalysisResult, ReadingModeResult, AnalysisMode } from '@/lib/types'
import { AlertCircle, X } from 'lucide-react'

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [mangaAnalysisResult, setMangaAnalysisResult] = useState<MangaAnalysisResult | null>(null)
  const [readingModeResult, setReadingModeResult] = useState<ReadingModeResult | null>(null)
  const [originalImageData, setOriginalImageData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('panel')
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null)

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result)
    setMangaAnalysisResult(null)
    setReadingModeResult(null)
    setOriginalImageData(null)
    setError(null)
    setSelectedPanelId(null)
  }

  const handleMangaAnalysisComplete = (result: MangaAnalysisResult) => {
    setMangaAnalysisResult(result)
    setAnalysisResult(null)
    setReadingModeResult(null)
    setError(null)
    setSelectedPanelId(null)
  }

  const handleReadingModeComplete = (result: ReadingModeResult) => {
    setReadingModeResult(result)
    setAnalysisResult(null)
    setMangaAnalysisResult(null)
    setError(null)
    setSelectedPanelId(null)
  }

  const handleOriginalImageChange = (imageData: string | null) => {
    setOriginalImageData(imageData)
    setAnalysisResult(null)
    setMangaAnalysisResult(null)
    setReadingModeResult(null)
    setError(null)
    setSelectedPanelId(null)
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    setAnalysisResult(null)
    setMangaAnalysisResult(null)
    setReadingModeResult(null)
    setOriginalImageData(null)
    setSelectedPanelId(null)
  }

  const clearError = () => setError(null)

  const setMode = (mode: AnalysisMode) => {
    setAnalysisMode(mode)
    setAnalysisResult(null)
    setMangaAnalysisResult(null)
    setReadingModeResult(null)
    setError(null)
    setSelectedPanelId(null)
  }

  const scrollToPanelAnalysis = (panelNumber: number) => {
    setSelectedPanelId(panelNumber)
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
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
            Learn Japanese Through Manga
          </h1>
          <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto">
            Upload manga pages and let AI extract and analyze Japanese text with detailed explanations
          </p>
        </motion.div>

        <div className="space-y-6 max-w-7xl mx-auto">
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
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 backdrop-blur-md">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-red-400 mb-1">Analysis Failed</h3>
                      <div className="text-sm text-red-300 whitespace-pre-line">{error}</div>
                    </div>
                    <button
                      onClick={clearError}
                      className="flex-shrink-0 p-1 hover:bg-red-500/20 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-red-400" />
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
              onReadingModeComplete={handleReadingModeComplete}
              onOriginalImageChange={handleOriginalImageChange}
              onError={handleError}
              analysisMode={analysisMode}
              onModeChange={setMode}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {readingModeResult ? (
              <div className="space-y-6">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                  <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                    👁️ Interactive Reading Mode
                  </h2>
                  <p className="text-gray-400 text-sm mb-4">
                    Click on any highlighted sentence to see translation and analysis
                  </p>
                  <ReadingModeViewer result={readingModeResult} />
                </div>
              </div>
            ) : mangaAnalysisResult ? (
              analysisMode === 'simple' ? (
                <SimpleModePanelViewer
                  result={mangaAnalysisResult}
                  originalImageData={originalImageData}
                />
              ) : (
                <div className="space-y-6">
                  {mangaAnalysisResult.panels.length > 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6"
                    >
                      <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        🎬 Panel Overview
                      </h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {mangaAnalysisResult.panels
                          .sort((a, b) => a.panelNumber - b.panelNumber)
                          .map((panel) => (
                            <div key={panel.panelNumber} className="relative group">
                              {panel.imageData ? (
                                <button
                                  onClick={() => scrollToPanelAnalysis(panel.panelNumber)}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2 hover:bg-white/10 hover:border-purple-500/50 transition-all transform hover:scale-105"
                                >
                                  <img
                                    src={`data:image/png;base64,${panel.imageData}`}
                                    alt={`Panel ${panel.panelNumber}`}
                                    className="w-full h-24 object-cover rounded-lg"
                                  />
                                  <div className="mt-2 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="bg-purple-500/80 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                                        Panel {panel.panelNumber}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-400 truncate" title={panel.extractedText}>
                                      {panel.extractedText || 'No text detected'}
                                    </p>
                                  </div>
                                </button>
                              ) : (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 h-32 flex items-center justify-center">
                                  <span className="text-sm text-gray-500">No image data</span>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-4">
                        💡 Click any panel to jump to its detailed analysis
                      </p>
                    </motion.div>
                  )}
                  
                  <MangaAnalyzer 
                    analysisResult={mangaAnalysisResult} 
                    selectedPanelId={selectedPanelId}
                    originalImageData={originalImageData || undefined}
                    isSimpleAnalysisMode={false}
                  />
                </div>
              )
            ) : analysisResult ? (
              <TextAnalyzer analysisResult={analysisResult} />
            ) : null}
          </motion.div>
        </div>
      </main>
    </div>
  )
}
