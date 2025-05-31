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
            <p className="text-white text-lg leading-relaxed font-japanese">
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
          <p className="text-white leading-relaxed">{analysisResult.translation}</p>
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
            <p className="text-gray-300 leading-relaxed">{analysisResult.summary}</p>
          </div>
        </motion.div>
      )}

      {/* Vocabulary Section */}
      {analysisResult.words && analysisResult.words.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600 overflow-hidden"
        >
          <div className="p-6 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 border-b border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/20">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Vocabulary Analysis</h3>
                  <p className="text-gray-400 text-sm">Key words and their meanings</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-indigo-600/20 text-indigo-300 text-sm rounded-full">
                {analysisResult.words.length} words
              </span>
            </div>
          </div>
          <div className="p-6">
            <div className="grid gap-4">
              {analysisResult.words.map((word, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-gray-700"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-semibold text-white font-japanese">
                        {word.word}
                      </span>
                      <span className="text-gray-400 font-japanese">
                        ({word.reading})
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(word.difficulty)}`}>
                        {getDifficultyIcon(word.difficulty)} {word.difficulty}
                      </span>
                    </div>
                    <p className="text-gray-300 mb-1">{word.meaning}</p>
                    <p className="text-gray-500 text-sm">{word.partOfSpeech}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(`${word.word} (${word.reading}) - ${word.meaning}`, `word-${index}`)}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {copiedText === `word-${index}` ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Grammar Section */}
      {analysisResult.grammar && analysisResult.grammar.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-gray-600 overflow-hidden"
        >
          <div className="p-6 bg-gradient-to-r from-orange-600/10 to-red-600/10 border-b border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/20">
                  <Brain className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Grammar Patterns</h3>
                  <p className="text-gray-400 text-sm">Important grammar structures explained</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-orange-600/20 text-orange-300 text-sm rounded-full">
                {analysisResult.grammar.length} patterns
              </span>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {analysisResult.grammar.map((grammar, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="p-4 bg-white/5 rounded-xl border border-gray-700"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-lg font-semibold text-white font-japanese">
                      {grammar.pattern}
                    </h4>
                    <button
                      onClick={() => copyToClipboard(`${grammar.pattern}\n\n${grammar.explanation}\n\nExample: ${grammar.example}`, `grammar-${index}`)}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {copiedText === `grammar-${index}` ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-gray-300 mb-3 leading-relaxed">
                    {grammar.explanation}
                  </p>
                  <div className="p-3 bg-gray-800/50 rounded-lg border-l-4 border-orange-500">
                    <p className="text-gray-400 text-sm mb-1">Example:</p>
                    <p className="text-white font-japanese">{grammar.example}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
