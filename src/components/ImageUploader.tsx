'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileImage, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { SUPPORTED_IMAGE_TYPES, type AnalysisResult, type MangaAnalysisResult, type ReadingModeResult, type AnalysisMode } from '@/lib/types'
import { useAIProviderStore } from '@/lib/store'
import { useClientPanelSegmentation } from '@/hooks/useClientPanelSegmentation'
import { analyzeImageForReading } from '@/lib/client-api'

interface ImageUploaderProps {
  onAnalysisComplete: (result: AnalysisResult) => void
  onMangaAnalysisComplete: (result: MangaAnalysisResult) => void
  onReadingModeComplete: (result: ReadingModeResult) => void
  onOriginalImageChange: (imageData: string | null) => void
  onError: (errorMessage: string) => void
  analysisMode: AnalysisMode
}

export default function ImageUploader({ onAnalysisComplete, onMangaAnalysisComplete, onReadingModeComplete, onOriginalImageChange, onError, analysisMode }: ImageUploaderProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [segmentationStatus, setSegmentationStatus] = useState<'idle' | 'segmenting' | 'complete' | 'error'>('idle')
  const { selectedProvider, openaiFormatSettings, modelSettings, apiKeySettings } = useAIProviderStore()
  const { segmentPanels, isLoading: isSegmenting, error: segmentationError, isAvailable: isClientSegmentationAvailable } = useClientPanelSegmentation()

  const processImage = useCallback(async (file: File) => {
    if (!file) return

    setIsAnalyzing(true)
    setProgress(0)

    try {
      // Convert file to base64
      const reader = new FileReader()
      reader.onload = async () => {
        const imageBase64 = (reader.result as string).split(',')[1]
        setUploadedImage(reader.result as string)
        onOriginalImageChange(imageBase64) // Store the original image data
        setProgress(20)

        try {
          console.log('🔍 Debug: analysisMode =', analysisMode)
          console.log('🔍 Debug: isClientSegmentationAvailable =', isClientSegmentationAvailable)
          
          if (analysisMode === 'panel') {
            // Panel Analysis Mode: Try client-side segmentation first
            if (isClientSegmentationAvailable) {
              try {
                setSegmentationStatus('segmenting')
                setProgress(30)
                
                console.log('🔍 Starting client-side panel segmentation...')
                const segmentationResult = await segmentPanels(imageBase64)
                
                console.log('📊 Segmentation result:', segmentationResult)
                
                // If we found panels, proceed with panel-by-panel analysis
                if (segmentationResult.panels.length > 0) {
                  setSegmentationStatus('complete')
                  setProgress(50)
                  
                  // Now analyze each panel using the API
                  const panelAnalyses = await Promise.allSettled(
                    segmentationResult.panels.map(async (panel, index) => {
                      const response = await fetch('/api/analyze', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          imageBase64: panel.imageData,
                          provider: selectedProvider,
                          modelSettings,
                          apiKeySettings,
                          openaiFormatSettings,
                          mangaMode: false // Analyze individual panels as regular images
                        }),
                      })
                      
                      if (!response.ok) {
                        throw new Error(`Failed to analyze panel ${index + 1}`)
                      }
                      
                      const panelResult = await response.json()
                      return {
                        panelNumber: index + 1,
                        position: panel.boundingBox,
                        imageData: panel.imageData,
                        extractedText: panelResult.extractedText || '',
                        sentences: panelResult.sentences || [],
                        translation: panelResult.translation || '',
                        words: panelResult.words || [],
                        grammar: panelResult.grammar || [],
                        context: panelResult.summary || panelResult.context || ''
                      }
                    })
                  )
                  
                  setProgress(90)
                  
                  // Extract successful analyses
                  const panels = panelAnalyses
                    .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
                    .map(result => result.value)
                  
                  const mangaResult: MangaAnalysisResult = {
                    panels,
                    overallSummary: `This manga page contains ${panels.length} panels with segmented content.`,
                    readingOrder: segmentationResult.readingOrder,
                    provider: selectedProvider
                  }
                  
                  setProgress(100)
                  setIsAnalyzing(false)
                  toast.success(`✅ Manga analyzed with client-side segmentation! Found ${panels.length} panels.`)
                  onMangaAnalysisComplete(mangaResult)
                  return // Exit early on successful panel segmentation
                }
              } catch (segError) {
                console.log('⚠️ Client-side segmentation failed, falling back to LLM analysis:', segError)
                setSegmentationStatus('error')
                // Continue to LLM-based manga analysis below
              }
            }
          }
          
          // Reading Mode: Use LLM to identify sentences and their locations
          if (analysisMode === 'reading') {
            try {
              console.log('🔍 Starting reading mode analysis...')
              setProgress(30)
              
              const readingResult = await analyzeImageForReading(imageBase64, {
                provider: selectedProvider,
                openaiFormatSettings,
                modelSettings,
                apiKeySettings
              })
              
              setProgress(90)
              
              if (readingResult) {
                console.log('✅ Reading mode analysis successful:', readingResult)
                setProgress(100)
                setIsAnalyzing(false)
                toast.success(`✅ Reading mode analysis complete using ${selectedProvider.toUpperCase()}!`)
                onReadingModeComplete(readingResult)
                return
              }
            } catch (readingError) {
              console.log('⚠️ Reading mode analysis failed:', readingError)
              setIsAnalyzing(false)
              setProgress(0)
              onError(`Reading mode analysis failed: ${readingError instanceof Error ? readingError.message : String(readingError)}`)
              return
            }
          }

          // Simple Analysis Mode: Try LLM-based panel analysis first, fallback to simple text analysis
          if (analysisMode === 'simple') {
            try {
              setSegmentationStatus('segmenting')
              setProgress(30)
              
              console.log('🔍 Starting LLM-based panel analysis for simple mode...')
              
              const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  imageBase64,
                  provider: selectedProvider,
                  modelSettings,
                  apiKeySettings,
                  openaiFormatSettings,
                  mangaMode: false, // Don't use regular manga mode
                  simpleAnalysisMode: true // Use simple analysis mode which triggers LLM-based panel detection
                }),
              })

              setProgress(60)

              if (response.ok) {
                const result: MangaAnalysisResult = await response.json()
                
                // Check if we got meaningful panel results
                if (result && 'panels' in result && result.panels.length > 0) {
                  setSegmentationStatus('complete')
                  setProgress(100)
                  setIsAnalyzing(false)
                  toast.success(`✅ Image analyzed with LLM-based panel detection! Found ${result.panels.length} panels.`)
                  onMangaAnalysisComplete(result)
                  return // Exit early on successful LLM panel analysis
                }
              }
              
              console.log('⚠️ LLM panel analysis failed or returned no panels, falling back to simple text analysis')
              setSegmentationStatus('error')
              // Continue to simple text analysis fallback below
              
            } catch (llmError) {
              console.log('⚠️ LLM panel analysis failed, falling back to simple text analysis:', llmError)
              setSegmentationStatus('error')
              // Continue to simple text analysis fallback below
            }
          }
          
          // Fallback: Use server-side analysis (manga mode for panel analysis, simple for text analysis)
          console.log('🔄 Using fallback analysis method...')
          
          if (analysisMode === 'panel') {
            setSegmentationStatus('segmenting')
            setProgress(30)
          }
          setProgress(40)
          
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageBase64,
              provider: selectedProvider,
              modelSettings,
              apiKeySettings,
              openaiFormatSettings,
              mangaMode: analysisMode === 'panel',
              simpleAnalysisMode: analysisMode === 'simple' // Use simple analysis mode when in simple mode
            }),
          })

          if (analysisMode === 'panel') {
            setSegmentationStatus('complete')
          }

          setProgress(70)

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to analyze image')
          }

          const result: AnalysisResult | MangaAnalysisResult = await response.json()
          setProgress(100)
          setIsAnalyzing(false)

          // Show success message
          if (analysisMode === 'panel') {
            toast.success(`✅ Manga analyzed using ${result.provider?.toUpperCase()}!`)
            if ('panels' in result) {
              onMangaAnalysisComplete(result as MangaAnalysisResult)
            } else {
              throw new Error('Expected manga analysis result but got simple analysis')
            }
          } else {
            toast.success(`✅ Image analyzed using ${result.provider?.toUpperCase()}!`)
            if ('panels' in result) {
              onMangaAnalysisComplete(result as MangaAnalysisResult)
            } else {
              onAnalysisComplete(result as AnalysisResult)
            }
          }

        } catch (error) {
          console.error('Analysis error:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image'
          onError(errorMessage)
          setIsAnalyzing(false)
          setProgress(0)
          setSegmentationStatus('error')
        }
      }

      reader.onerror = () => {
        onError('Failed to read image file')
        setIsAnalyzing(false)
      }

      reader.readAsDataURL(file)

    } catch (error) {
      console.error('Image processing error:', error)
      onError('Failed to process image')
      setIsAnalyzing(false)
      setProgress(0)
      setSegmentationStatus('error')
    }
  }, [selectedProvider, openaiFormatSettings, modelSettings, apiKeySettings, analysisMode, onAnalysisComplete, onMangaAnalysisComplete, onReadingModeComplete, onError, segmentPanels, isClientSegmentationAvailable])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        processImage(file)
      }
    },
    [processImage]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: SUPPORTED_IMAGE_TYPES,
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB limit
  })

  const resetUpload = () => {
    setUploadedImage(null)
    onOriginalImageChange(null) // Clear the original image data
    setIsAnalyzing(false)
    setProgress(0)
    setSegmentationStatus('idle')
  }

  const getStatusIcon = () => {
    if (isAnalyzing) {
      return <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    }
    if (progress === 100) {
      return <CheckCircle className="w-8 h-8 text-green-400" />
    }
    return <Upload className="w-8 h-8 text-purple-400" />
  }

  const getStatusText = () => {
    if (isAnalyzing) {
      if (progress < 40) return 'Reading image...'
      if (progress < 70) {
        if (analysisMode === 'panel') {
          if (segmentationStatus === 'segmenting') return 'Segmenting manga panels...'
          if (segmentationStatus === 'complete') return 'Analyzing panels with AI...'
          return 'Identifying manga panels...'
        } else {
          if (segmentationStatus === 'segmenting') return 'Detecting panels with AI...'
          if (segmentationStatus === 'complete') return 'Analyzing detected content...'
          return 'Analyzing image content...'
        }
        return 'Extracting Japanese text...'
      }
      if (progress < 100) {
        return analysisMode === 'panel' 
          ? 'Analyzing panels with AI...' 
          : analysisMode === 'reading'
          ? 'Identifying sentences with AI...'
          : 'Analyzing with AI...'
      }
    }
    if (progress === 100) return 'Analysis complete!'
    return analysisMode === 'panel' 
      ? 'Upload manga page for panel analysis' 
      : analysisMode === 'reading'
      ? 'Upload manga image for reading mode'
      : 'Upload manga image'
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {!uploadedImage ? (
          <motion.div
            key="uploader"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div
              {...getRootProps()}
              className={`
                relative overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer
                transition-all duration-300 backdrop-blur-md
                ${
                  isDragActive
                    ? 'border-purple-400 bg-purple-500/10'
                    : 'border-gray-600 bg-white/5 hover:bg-white/10 hover:border-purple-500'
                }
              `}
            >
              <input {...getInputProps()} />
              
              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                  <FileImage className="w-8 h-8 text-purple-400" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">
                    {isDragActive ? 'Drop your manga image here' : 'Upload Manga Image'}
                  </h3>
                  <p className="text-gray-400">
                    AI will automatically extract and analyze Japanese text
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports PNG, JPG, JPEG, WebP (max 10MB)
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
                >
                  Choose File
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-md border border-gray-600"
          >
            {/* Close button */}
            <button
              onClick={resetUpload}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            {/* Image preview */}
            <div className="relative">
              <img
                src={uploadedImage}
                alt="Uploaded manga"
                className="w-full h-64 object-contain bg-gray-900/50"
              />
              
              {/* Progress overlay */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
                    <div className="text-white font-medium">{getStatusText()}</div>
                    <div className="w-64 bg-gray-700 rounded-full h-2">
                      <motion.div
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status section */}
            <div className="p-6 border-t border-gray-700">
              <div className="flex items-center gap-4">
                {getStatusIcon()}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{getStatusText()}</h3>
                  <p className="text-gray-400 text-sm">
                    Using {selectedProvider.toUpperCase()} AI vision model for text recognition
                  </p>
                </div>
                {progress === 100 && (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                )}
              </div>

              {/* Progress bar */}
              {isAnalyzing && (
                <div className="mt-4 w-full bg-gray-700 rounded-full h-2">
                  <motion.div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
