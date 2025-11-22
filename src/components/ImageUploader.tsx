'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileImage, Loader2, CheckCircle, X, BookOpen, FileText, Eye } from 'lucide-react'
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
  onModeChange: (mode: AnalysisMode) => void
}

export default function ImageUploader({
  onAnalysisComplete,
  onMangaAnalysisComplete,
  onReadingModeComplete,
  onOriginalImageChange,
  onError,
  analysisMode,
  onModeChange
}: ImageUploaderProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [segmentationStatus, setSegmentationStatus] = useState<'idle' | 'segmenting' | 'complete' | 'error'>('idle')
  const { selectedProvider, openaiFormatSettings, modelSettings, apiKeySettings } = useAIProviderStore()
  const { segmentPanels, isAvailable: isClientSegmentationAvailable } = useClientPanelSegmentation()
  const modeOptions: Record<
    AnalysisMode,
    { label: string; shortLabel: string; icon: typeof BookOpen; accent: string }
  > = {
    panel: {
      label: 'Panel Analysis',
      shortLabel: 'Panel',
      icon: BookOpen,
      accent: 'from-blue-500 to-cyan-500'
    },
    simple: {
      label: 'Simple Analysis',
      shortLabel: 'Simple',
      icon: FileText,
      accent: 'from-purple-500 to-pink-500'
    },
    reading: {
      label: 'Reading Mode',
      shortLabel: 'Reading',
      icon: Eye,
      accent: 'from-emerald-500 to-lime-500'
    }
  }

  const analyzeImageData = useCallback(async (imageToAnalyze: string | null) => {
    if (!imageToAnalyze) {
      toast.error('Please upload an image before running analysis.')
      return
    }

    setIsAnalyzing(true)
    setProgress(20)
    setSegmentationStatus('idle')

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
            const segmentationResult = await segmentPanels(imageToAnalyze)
            
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
          
          const readingResult = await analyzeImageForReading(imageToAnalyze, {
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
              imageBase64: imageToAnalyze,
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
          imageBase64: imageToAnalyze,
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
      } else if (analysisMode === 'simple' && 'panels' in result) {
        toast.success(`✅ Image analyzed using ${result.provider?.toUpperCase()}!`)
        onMangaAnalysisComplete(result as MangaAnalysisResult)
      } else {
        toast.success(`✅ Image analyzed using ${result.provider?.toUpperCase()}!`)
        onAnalysisComplete(result as AnalysisResult)
      }

    } catch (error) {
      console.error('Analysis error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image'
      onError(errorMessage)
      setIsAnalyzing(false)
      setProgress(0)
      setSegmentationStatus('error')
    }
  }, [analysisMode, apiKeySettings, isClientSegmentationAvailable, modelSettings, onAnalysisComplete, onError, onMangaAnalysisComplete, onReadingModeComplete, openaiFormatSettings, segmentPanels, selectedProvider])

  const prepareImage = useCallback((file: File) => {
    if (!file) return

    setProgress(0)
    setSegmentationStatus('idle')
    setIsAnalyzing(false)

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      setUploadedImage(dataUrl)
      setImageBase64(base64)
      onOriginalImageChange(base64)
      toast.success('Image uploaded! Choose a mode and click Analyze.')
    }
    reader.onerror = () => {
      onError('Failed to read image file')
    }
    reader.readAsDataURL(file)
  }, [onError, onOriginalImageChange])

  const handleAnalyzeClick = useCallback(() => {
    if (!imageBase64) {
      toast.error('Upload an image before analyzing.')
      return
    }
    if (isAnalyzing) return
    onOriginalImageChange(imageBase64)
    analyzeImageData(imageBase64)
  }, [analyzeImageData, imageBase64, isAnalyzing, onOriginalImageChange])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        prepareImage(file)
      }
    },
    [prepareImage]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: SUPPORTED_IMAGE_TYPES,
    multiple: false,
    maxSize: 10 * 1024 * 1024, // 10MB limit
  })

  const resetUpload = () => {
    setUploadedImage(null)
    setImageBase64(null)
    onOriginalImageChange(null) // Clear the original image data
    setIsAnalyzing(false)
    setProgress(0)
    setSegmentationStatus('idle')
  }

  const getStatusIcon = () => {
    if (isAnalyzing) {
      return <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
    }
    if (progress === 100) {
      return <CheckCircle className="w-6 h-6 text-green-400" />
    }
    if (uploadedImage) {
      return <FileImage className="w-6 h-6 text-purple-400" />
    }
    return <Upload className="w-6 h-6 text-purple-400" />
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
    if (uploadedImage) {
      return analysisMode === 'panel' 
        ? 'Image ready. Run panel analysis when you are ready.'
        : analysisMode === 'reading'
        ? 'Image ready. Run reading mode when you are ready.'
        : 'Image ready. Run simple analysis when you are ready.'
    }
    return analysisMode === 'panel' 
      ? 'Upload manga page for panel analysis' 
      : analysisMode === 'reading'
      ? 'Upload manga image for reading mode'
      : 'Upload manga image'
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-2xl border border-gray-700 bg-white/5 backdrop-blur-xl p-3 md:p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
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
                      relative overflow-hidden rounded-xl border-2 border-dashed p-4 md:p-5 text-center cursor-pointer
                      transition-all duration-300
                      ${
                        isDragActive
                          ? 'border-purple-400 bg-purple-500/10'
                          : 'border-white/10 bg-white/5 hover:border-purple-400 hover:bg-white/10'
                      }
                    `}
                  >
                    <input {...getInputProps()} />
                    
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                        <FileImage className="w-5 h-5 text-purple-400" />
                      </div>
                      
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-semibold text-white">
                          {isDragActive ? 'Drop image here' : 'Upload Manga Image'}
                        </h3>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, JPEG, WebP (max 10MB)
                        </p>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm font-medium hover:from-purple-700 hover:to-pink-700 transition-all duration-200"
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
                  className="relative overflow-hidden rounded-xl bg-white/5 backdrop-blur-md border border-gray-600"
                >
                  <button
                    onClick={resetUpload}
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/25 hover:bg-black/40 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>

                  <div className="relative">
                    <img
                      src={uploadedImage}
                      alt="Uploaded manga"
                      className="w-full h-40 md:h-48 object-contain bg-gray-900/50"
                    />
                    
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                          <div className="text-white text-xs font-medium">{getStatusText()}</div>
                          <div className="w-40 bg-gray-700 rounded-full h-1">
                            <motion.div
                              className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 border-t border-gray-700 space-y-1.5">
                    <div className="flex items-center gap-2">
                      {getStatusIcon()}
                      <div>
                        <p className="text-xs font-semibold text-white">{getStatusText()}</p>
                        <p className="text-[10px] text-gray-400">
                          {selectedProvider.toUpperCase()}
                        </p>
                      </div>
                      {progress === 100 && (
                        <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />
                      )}
                    </div>
                    {isAnalyzing && (
                      <div className="w-full bg-gray-700 rounded-full h-1">
                        <motion.div
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-1 rounded-full"
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

          <div className="w-full md:w-64 lg:w-72 flex flex-col gap-2.5">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-1.5">Select Mode</p>
              <div className="space-y-1.5">
                {(Object.keys(modeOptions) as AnalysisMode[]).map((modeKey) => {
                  const mode = modeOptions[modeKey]
                  const Icon = mode.icon
                  const isActive = analysisMode === modeKey
                  return (
                    <button
                      key={modeKey}
                      onClick={() => onModeChange(modeKey)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all w-full ${
                        isActive
                          ? 'border-white/60 bg-white/10 shadow-lg shadow-purple-500/20'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      <div className={`rounded-lg bg-gradient-to-br ${mode.accent} p-2 text-white flex-shrink-0`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex flex-col leading-tight">
                        <p className="font-semibold text-white text-sm">{mode.label}</p>
                        <span className="text-[11px] uppercase tracking-wide text-gray-400">{mode.shortLabel}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              onClick={handleAnalyzeClick}
              disabled={!imageBase64 || isAnalyzing}
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                !imageBase64 || isAnalyzing
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
              }`}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Image'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
