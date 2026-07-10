'use client'

import { useState } from 'react'
import ImageUploader from '@/components/ImageUploader'
import MokuroReader from '@/components/MokuroReader'
import ReadingModeViewer from '@/components/ReadingModeViewer'
import ImagePageAnalysisViewer from '@/components/ImagePageAnalysisViewer'
import Header from '@/components/Header'
import WordBankDrawer from '@/components/WordBankDrawer'
import { motion, AnimatePresence } from 'framer-motion'
import { AnalysisLanguage, AnalysisResult, ReadingModeResult, AnalysisMode } from '@/lib/types'
import { AlertCircle, X } from 'lucide-react'

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [readingModeResult, setReadingModeResult] = useState<ReadingModeResult | null>(null)
  const [originalImageData, setOriginalImageData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('image')
  const [imageAnalysisLanguage, setImageAnalysisLanguage] = useState<AnalysisLanguage>('zh')
  const [isWordBankOpen, setIsWordBankOpen] = useState(false)

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result)
    setReadingModeResult(null)
    setError(null)
  }

  const handleReadingModeComplete = (result: ReadingModeResult) => {
    setReadingModeResult(result)
    setAnalysisResult(null)
    setError(null)
  }

  const handleOriginalImageChange = (imageData: string | null) => {
    setOriginalImageData(imageData)
    setAnalysisResult(null)
    setReadingModeResult(null)
    setError(null)
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    setAnalysisResult(null)
    setReadingModeResult(null)
    setOriginalImageData(null)
  }

  const clearError = () => setError(null)

  const setMode = (mode: AnalysisMode) => {
    setAnalysisMode(mode)
    setAnalysisResult(null)
    setReadingModeResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen">
      <Header onOpenWordBank={() => setIsWordBankOpen(true)} />
      
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
              onReadingModeComplete={handleReadingModeComplete}
              onOriginalImageChange={handleOriginalImageChange}
              onError={handleError}
              analysisMode={analysisMode}
              onModeChange={setMode}
              analysisLanguage={imageAnalysisLanguage}
              onAnalysisLanguageChange={setImageAnalysisLanguage}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {analysisMode === 'mokuro' ? (
              <MokuroReader />
            ) : readingModeResult ? (
              <ReadingModeViewer
                key={readingModeResult.imageData}
                result={readingModeResult}
                language={imageAnalysisLanguage}
              />
            ) : analysisResult ? (
              <ImagePageAnalysisViewer
                analysisResult={analysisResult}
                imageData={originalImageData}
                language={imageAnalysisLanguage}
              />
            ) : null}
          </motion.div>
        </div>
      </main>
      <WordBankDrawer open={isWordBankOpen} onClose={() => setIsWordBankOpen(false)} />
    </div>
  )
}
