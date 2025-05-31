'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileImage, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { SUPPORTED_IMAGE_TYPES, type AnalysisResult } from '@/lib/types'
import { useAIProviderStore } from '@/lib/store'

interface ImageUploaderProps {
  onAnalysisComplete: (result: AnalysisResult) => void
}

export default function ImageUploader({ onAnalysisComplete }: ImageUploaderProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const { selectedProvider, openaiFormatSettings } = useAIProviderStore()

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
        setProgress(20)

        try {
          // Send image to AI for analysis
          setProgress(40)
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageBase64,
              provider: selectedProvider,
              ...(selectedProvider === 'openai-format' && { openaiFormatSettings }),
            }),
          })

          setProgress(70)

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to analyze image')
          }

          const result: AnalysisResult = await response.json()
          setProgress(100)

          // Show success message
          toast.success(`✅ Image analyzed successfully using ${result.provider?.toUpperCase()}!`)
          
          // Pass result to parent component
          onAnalysisComplete(result)

        } catch (error) {
          console.error('Analysis error:', error)
          toast.error(error instanceof Error ? error.message : 'Failed to analyze image')
          setIsAnalyzing(false)
          setProgress(0)
        }
      }

      reader.onerror = () => {
        toast.error('Failed to read image file')
        setIsAnalyzing(false)
      }

      reader.readAsDataURL(file)

    } catch (error) {
      console.error('Image processing error:', error)
      toast.error('Failed to process image')
      setIsAnalyzing(false)
      setProgress(0)
    }
  }, [selectedProvider, onAnalysisComplete])

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
    setIsAnalyzing(false)
    setProgress(0)
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
      if (progress < 70) return 'Extracting Japanese text...'
      if (progress < 100) return 'Analyzing with AI...'
    }
    if (progress === 100) return 'Analysis complete!'
    return 'Upload manga image'
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
