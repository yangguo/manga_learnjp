'use client'

import { useState } from 'react'
import ImageUploader from '@/components/ImageUploader'
import TextAnalyzer from '@/components/TextAnalyzer'
import Header from '@/components/Header'
import DemoSection from '@/components/DemoSection'
import { motion } from 'framer-motion'
import { AnalysisResult } from '@/lib/types'

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result)
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
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            Upload manga pages and let AI extract and analyze Japanese text with detailed explanations
          </p>
        </motion.div>

        <div className="space-y-8 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <ImageUploader onAnalysisComplete={handleAnalysisComplete} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <TextAnalyzer analysisResult={analysisResult} />
          </motion.div>
        </div>

        <DemoSection />
      </main>
    </div>
  )
}
