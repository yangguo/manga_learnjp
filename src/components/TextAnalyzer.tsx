'use client'

import { useState } from 'react'
import { Brain, BookOpen, Zap, Copy, Check, Sparkles, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { AnalysisResult } from '@/lib/types'

interface TextAnalyzerProps {
  analysisResult: AnalysisResult | null
}

export default function TextAnalyzer({ analysisResult }: TextAnalyzerProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(type)
      toast.success(`📋 ${type} copied to clipboard!`)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (err) {
      toast.error('Failed to copy text')
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-100'
      case 'intermediate': return 'text-yellow-600 bg-yellow-100'
      case 'advanced': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '🟢'
      case 'intermediate': return '🟡'
      case 'advanced': return '🔴'
      default: return '⚪'
    }
  }

  if (!analysisResult) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl mx-auto"
      >
        <div className="text-center py-12 bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600">
          <Brain className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Upload an image to get started</h3>
          <p className="text-gray-400">
            Upload a manga image and our AI will extract and analyze the Japanese text for you
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      {/* Header with provider info */}
      <div className="flex items-center justify-between bg-white/5 backdrop-blur-md rounded-xl p-4 border border-gray-600">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20">
            {analysisResult?.provider && (
              <div className="text-lg">
                {analysisResult.provider === 'gemini' ? (
                  <span className="text-blue-400">🤖</span>
                ) : (
                  <span className="text-green-400">🧠</span>
                )}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Analysis Complete</h3>
            <p className="text-gray-400 text-sm">
              Powered by {analysisResult.provider === 'gemini' ? 'Google Gemini' : 'OpenAI GPT-4'}
            </p>
          </div>
        </div>
        <div className="text-green-400">
          <Check className="w-6 h-6" />
        </div>
      </div>

      {/* Extracted Text Section */}
      {analysisResult.extractedText && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600 overflow-hidden"
        >
          <div className="p-6 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border-b border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Extracted Text</h3>
                  <p className="text-gray-400 text-sm">Japanese text found in the image</p>
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(analysisResult.extractedText, 'extracted text')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-colors"
              >
                {copiedText === 'extracted text' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Copy
              </button>
            </div>
          </div>
          <div className="p-6">
            <p className="text-gray-900 text-lg leading-relaxed font-japanese bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              {analysisResult.extractedText}
            </p>
          </div>
        </motion.div>
      )}

      {/* Translation Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600 overflow-hidden"
      >
        <div className="p-6 bg-gradient-to-r from-green-600/10 to-emerald-600/10 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20">
                <Zap className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Translation</h3>
                <p className="text-gray-400 text-sm">English translation with context</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(analysisResult.translation, 'translation')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg transition-colors"
            >
              {copiedText === 'translation' ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              Copy
            </button>
          </div>
        </div>
        <div className="p-6">
          <p className="text-gray-900 leading-relaxed bg-white p-4 rounded-lg border border-gray-200 shadow-sm">{analysisResult.translation}</p>
        </div>
      </motion.div>

      {/* Summary Section */}
      {analysisResult.summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600 overflow-hidden"
        >
          <div className="p-6 bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-b border-gray-600">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/20">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Context Summary</h3>
                <p className="text-gray-400 text-sm">What's happening in this scene</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <p className="text-gray-900 leading-relaxed bg-white p-4 rounded-lg border border-gray-200 shadow-sm">{analysisResult.summary}</p>
          </div>
        </motion.div>
      )}

      {/* Sentence-by-Sentence Analysis */}
      {analysisResult.sentences && analysisResult.sentences.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600 overflow-hidden"
        >
          <div className="p-6 bg-gradient-to-r from-teal-600/10 to-cyan-600/10 border-b border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-500/20">
                  <FileText className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Sentence Analysis</h3>
                  <p className="text-gray-400 text-sm">Detailed breakdown of each sentence</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-teal-600/20 text-teal-300 text-sm rounded-full">
                {analysisResult.sentences.length} sentences
              </span>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {analysisResult.sentences.map((sentence, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="p-4 bg-white rounded-xl border border-gray-300 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900 font-japanese mb-2">
                        {sentence.sentence}
                      </h4>
                      <p className="text-gray-800 mb-2">{sentence.translation}</p>
                      {sentence.context && (
                        <p className="text-gray-600 text-sm italic">{sentence.context}</p>
                      )}
                    </div>
                    <button
                      onClick={() => copyToClipboard(`${sentence.sentence}\n${sentence.translation}`, `sentence-${index}`)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {copiedText === `sentence-${index}` ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>

                  {/* Words in this sentence */}
                  {sentence.words && sentence.words.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <h5 className="text-sm font-medium text-blue-900 mb-3">📚 Vocabulary in this sentence:</h5>
                      <div className="space-y-3">
                        {sentence.words.map((word, wordIndex) => (
                          <div
                            key={wordIndex}
                            className={`p-3 rounded-lg border ${getDifficultyColor(word.difficulty)}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-japanese font-semibold text-lg">{word.word}</span>
                              <span className="text-gray-600 font-japanese">({word.reading})</span>
                              <span className="text-xs px-2 py-1 rounded-full bg-white/50">
                                {getDifficultyIcon(word.difficulty)} {word.difficulty}
                              </span>
                            </div>
                            <div className="text-sm space-y-1">
                              <p><span className="font-medium">Meaning:</span> {word.meaning}</p>
                              <p><span className="font-medium">Part of speech:</span> {word.partOfSpeech}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grammar in this sentence */}
                  {sentence.grammar && sentence.grammar.length > 0 && (
                    <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                      <h5 className="text-sm font-medium text-orange-900 mb-3">⚙️ Grammar patterns in this sentence:</h5>
                      <div className="space-y-3">
                        {sentence.grammar.map((grammar, grammarIndex) => (
                          <div key={grammarIndex} className="p-3 bg-white rounded-lg border border-orange-200">
                            <div className="mb-2">
                              <span className="font-semibold text-orange-800 font-japanese text-lg">{grammar.pattern}</span>
                            </div>
                            <div className="text-sm space-y-2">
                              <p><span className="font-medium text-orange-900">Explanation:</span> {grammar.explanation}</p>
                              <div className="bg-orange-50 p-2 rounded border-l-4 border-orange-400">
                                <p className="text-orange-800"><span className="font-medium">Example:</span> {grammar.example}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}


    </motion.div>
  )
}
