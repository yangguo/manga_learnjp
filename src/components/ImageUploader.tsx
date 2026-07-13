'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileImage, Loader2, CheckCircle, X, FileJson, FileText, Languages, type LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { ANALYSIS_MODE_OPTIONS, IMAGE_ANALYSIS_LANGUAGE_OPTIONS } from '@/lib/analysis-modes'
import { SUPPORTED_IMAGE_TYPES, type AnalysisLanguage, type AnalysisResult, type ReadingModeResult, type AnalysisMode } from '@/lib/types'
import { useAIProviderStore } from '@/lib/store'
import { analyzeImage, analyzeImageForReading } from '@/lib/client-api'
import { compressImageForAPI } from '@/lib/image-compression'

const MODE_VISUALS: Record<AnalysisMode, { icon: LucideIcon; accent: string }> = {
  image: {
    icon: FileImage,
    accent: 'from-blue-500 to-cyan-500'
  },
  mokuro: {
    icon: FileJson,
    accent: 'from-amber-500 to-orange-500'
  },
  text: {
    icon: FileText,
    accent: 'from-purple-500 to-pink-500'
  }
}

const hasReadingSentences = (result: ReadingModeResult): boolean => {
  return Array.isArray(result.sentences) && result.sentences.length > 0
}

interface ImageUploaderProps {
  onAnalysisComplete: (result: AnalysisResult) => void
  onReadingModeComplete: (result: ReadingModeResult) => void
  onOriginalImageChange: (imageData: string | null) => void
  onError: (errorMessage: string) => void
  analysisMode: AnalysisMode
  onModeChange: (mode: AnalysisMode) => void
  analysisLanguage: AnalysisLanguage
  onAnalysisLanguageChange: (language: AnalysisLanguage) => void
}

export default function ImageUploader({
  onAnalysisComplete,
  onReadingModeComplete,
  onOriginalImageChange,
  onError,
  analysisMode,
  onModeChange,
  analysisLanguage,
  onAnalysisLanguageChange
}: ImageUploaderProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const { selectedProvider } = useAIProviderStore()

  const analyzeImageData = useCallback(async (imageToAnalyze: string | null) => {
    if (analysisMode === 'mokuro') {
      toast('Use the Mokuro Reader panel below.')
      return
    }
    if (!imageToAnalyze) {
      toast.error('Please upload an image before running analysis.')
      return
    }

    setIsAnalyzing(true)
    setProgress(20)

    try {
      // Compress to stay under Vercel's 4.5 MB request payload limit.
      // 3500 KB base64 is about 2.6 MB raw; total JSON body stays well under 4.5 MB.
      const imageForAPI = await compressImageForAPI(imageToAnalyze, 3500)

      try {
        setProgress(45)

        const readingResult = await analyzeImageForReading(imageForAPI, {
          provider: selectedProvider,
          language: analysisLanguage,
        })

        if (hasReadingSentences(readingResult)) {
          setProgress(100)
          setIsAnalyzing(false)
          toast.success(analysisLanguage === 'zh' ? '已完成图片分析。' : 'Image analysis complete.')
          onReadingModeComplete(readingResult)
          return
        }
      } catch (readingError) {
        console.log('Reading-location analysis failed, continuing to page analysis:', readingError)
      }

      setProgress(75)

      const result = await analyzeImage(imageForAPI, {
        provider: selectedProvider,
        language: analysisLanguage
      })
      setProgress(100)
      setIsAnalyzing(false)

      toast.success(analysisLanguage === 'zh' ? '已完成整页分析。' : 'Page analysis complete.')
      onAnalysisComplete(result)

    } catch (error) {
      console.error('Analysis error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image'
      onError(errorMessage)
      setIsAnalyzing(false)
      setProgress(0)
    }
  }, [analysisLanguage, analysisMode, onAnalysisComplete, onError, onReadingModeComplete, selectedProvider])

  const prepareImage = useCallback((file: File) => {
    if (!file) return

    setProgress(0)
    setIsAnalyzing(false)

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      setUploadedImage(dataUrl)
      setImageBase64(base64)
      onOriginalImageChange(base64)
      toast.success('Image uploaded. Click Analyze to start automatic analysis.')
    }
    reader.onerror = () => {
      onError('Failed to read image file')
    }
    reader.readAsDataURL(file)
  }, [onError, onOriginalImageChange])

  const handleAnalyzeClick = useCallback(() => {
    if (analysisMode === 'mokuro') {
      toast('Use the Mokuro Reader panel below.')
      return
    }
    if (!imageBase64) {
      toast.error('Upload an image before analyzing.')
      return
    }
    if (isAnalyzing) return
    onOriginalImageChange(imageBase64)
    analyzeImageData(imageBase64)
  }, [analysisMode, analyzeImageData, imageBase64, isAnalyzing, onOriginalImageChange])

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
    if (analysisMode === 'mokuro') {
      return 'Use the Mokuro Reader below to load a Mokuro output directory'
    }
    if (isAnalyzing) {
      if (progress < 35) return 'Preparing image...'
      if (progress < 65) return 'Finding text areas on this page...'
      if (progress < 85) return 'Analyzing this page...'
      if (progress < 100) return 'Finishing image analysis...'
    }
    if (progress === 100) return 'Analysis complete!'
    if (uploadedImage) {
      return 'Image ready. Run automatic analysis when you are ready.'
    }
    return 'Upload manga image for automatic analysis'
  }

  const analyzeDisabled = analysisMode === 'mokuro' || !imageBase64 || isAnalyzing

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-2xl border border-gray-700 bg-white/5 backdrop-blur-xl p-3 md:p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {analysisMode === 'mokuro' ? (
                <motion.div
                  key="mokuro-import"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-5"
                >
                  <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                      <FileJson className="h-5 w-5 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Mokuro Reader</h3>
                      <p className="mt-1 text-sm text-gray-400">
                        Choose the Mokuro output directory in the reader panel below.
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : !uploadedImage ? (
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
                {ANALYSIS_MODE_OPTIONS.map((mode) => {
                  const visual = MODE_VISUALS[mode.mode]
                  const Icon = visual.icon
                  const isActive = analysisMode === mode.mode
                  return (
                    <button
                      key={mode.mode}
                      onClick={() => onModeChange(mode.mode)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all w-full ${
                        isActive
                          ? 'border-white/60 bg-white/10 shadow-lg shadow-purple-500/20'
                          : 'border-white/10 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      <div className={`rounded-lg bg-gradient-to-br ${visual.accent} p-2 text-white flex-shrink-0`}>
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

            {analysisMode === 'image' && (
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-400">Explanation Language</p>
                <div className="inline-flex w-full items-center gap-1 rounded-lg border border-white/10 bg-gray-950/40 p-1">
                  <Languages size={15} className="ml-1.5 text-cyan-300" />
                  {IMAGE_ANALYSIS_LANGUAGE_OPTIONS.map(language => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => onAnalysisLanguageChange(language)}
                      className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                        analysisLanguage === language
                          ? 'bg-white text-gray-950'
                          : 'text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {language === 'zh' ? '中文' : 'English'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleAnalyzeClick}
              disabled={analyzeDisabled}
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                analyzeDisabled
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
              }`}
            >
              {analysisMode === 'mokuro' ? 'Use Mokuro Reader' : isAnalyzing ? 'Analyzing...' : 'Analyze Image'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
