'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ReadingModeResult, SentenceLocation } from '@/lib/types'
import { X, Volume2 } from 'lucide-react'

interface ReadingModeViewerProps {
  result: ReadingModeResult
}

interface SentenceDetailModalProps {
  sentence: SentenceLocation
  isOpen: boolean
  onClose: () => void
}

function SentenceDetailModal({ sentence, isOpen, onClose }: SentenceDetailModalProps) {
  if (!isOpen) return null

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ja-JP'
      speechSynthesis.speak(utterance)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-gray-800">Sentence Analysis</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Japanese Text */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-700">Japanese Text</h3>
              <button
                onClick={() => speakText(sentence.sentence)}
                className="text-blue-500 hover:text-blue-700 transition-colors"
                title="Listen to pronunciation"
              >
                <Volume2 size={18} />
              </button>
            </div>
            <p className="text-xl text-gray-900 bg-gray-50 p-3 rounded border-l-4 border-blue-500">
              {sentence.sentence}
            </p>
          </div>

          {/* Translation */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Translation</h3>
            <p className="text-gray-800 bg-green-50 p-3 rounded border-l-4 border-green-500">
              {sentence.translation}
            </p>
          </div>

          {/* Vocabulary */}
          {sentence.words && sentence.words.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Vocabulary</h3>
              <div className="grid gap-3">
                {sentence.words.map((word, index) => (
                  <div key={index} className="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{word.word}</span>
                      {word.reading && (
                        <span className="text-sm text-gray-600">({word.reading})</span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded ${
                        word.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                        word.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {word.difficulty}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{word.meaning}</p>
                    {word.partOfSpeech && (
                      <p className="text-xs text-gray-500 mt-1">Part of speech: {word.partOfSpeech}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grammar */}
          {sentence.grammar && sentence.grammar.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Grammar Patterns</h3>
              <div className="grid gap-3">
                {sentence.grammar.map((grammar, index) => (
                  <div key={index} className="bg-purple-50 p-3 rounded border border-purple-200">
                    <h4 className="font-medium text-purple-900 mb-1">{grammar.pattern}</h4>
                    <p className="text-sm text-gray-700 mb-2">{grammar.explanation}</p>
                    {grammar.example && (
                      <p className="text-sm text-purple-700 italic">Example: {grammar.example}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Context */}
          {sentence.context && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Context</h3>
              <p className="text-gray-700 bg-blue-50 p-3 rounded border-l-4 border-blue-500">
                {sentence.context}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReadingModeViewer({ result }: ReadingModeViewerProps) {
  const [selectedSentence, setSelectedSentence] = useState<SentenceLocation | null>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const updateImageSize = () => {
      if (imageRef.current) {
        setImageSize({
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight
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
  }, [result.imageData])

  const handleSentenceClick = (sentence: SentenceLocation) => {
    setSelectedSentence(sentence)
  }

  const closeModal = () => {
    setSelectedSentence(null)
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      {result.overallSummary && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Summary</h3>
          <p className="text-blue-800">{result.overallSummary}</p>
        </div>
      )}

      {/* Image with Sentence Overlays */}
      <div className="relative inline-block">
        <img
          ref={imageRef}
          src={result.imageData}
          alt="Manga page for reading"
          className="max-w-full h-auto rounded-lg shadow-lg"
        />
        
        {/* Sentence Rectangles */}
        {result.sentences.map((sentence, index) => {
          const { boundingBox } = sentence
          if (!boundingBox || imageSize.width === 0 || imageSize.height === 0) return null

          // Handle different coordinate formats - some APIs return 0-1 range, others 0-100
          const normalizeCoord = (coord: number) => coord > 1 ? coord / 100 : coord
          
          const left = normalizeCoord(boundingBox.x) * imageSize.width
          const top = normalizeCoord(boundingBox.y) * imageSize.height
          // Make rectangles smaller and shorter by reducing width and height by 30%
          const originalWidth = Math.min(normalizeCoord(boundingBox.width) * imageSize.width, imageSize.width - left)
          const originalHeight = Math.min(normalizeCoord(boundingBox.height) * imageSize.height, imageSize.height - top)
          const width = originalWidth * 0.7
          const height = originalHeight * 0.6

          return (
            <div
              key={index}
              className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20 cursor-pointer hover:bg-opacity-40 transition-all duration-200"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`
              }}
              onClick={() => handleSentenceClick(sentence)}
              title={`Click to analyze: ${sentence.sentence}`}
            >
              <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-1 py-0.5 rounded">
                {index + 1}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sentence List */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Identified Sentences ({result.sentences.length})
        </h3>
        <div className="grid gap-2">
          {result.sentences.map((sentence, index) => (
            <div
              key={index}
              className="bg-white p-3 rounded border border-gray-200 cursor-pointer hover:bg-blue-50 transition-colors"
              onClick={() => handleSentenceClick(sentence)}
            >
              <div className="flex items-start gap-3">
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-medium">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium mb-1">{sentence.sentence}</p>
                  <p className="text-gray-600 text-sm">{sentence.translation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sentence Detail Modal */}
      <SentenceDetailModal
        sentence={selectedSentence!}
        isOpen={!!selectedSentence}
        onClose={closeModal}
      />
    </div>
  )
}