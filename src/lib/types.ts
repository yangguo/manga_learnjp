export interface WordAnalysis {
  word: string
  reading: string
  meaning: string
  partOfSpeech: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export interface GrammarPattern {
  pattern: string
  explanation: string
  example: string
}

export interface OpenAIFormatSettings {
  endpoint: string
  model: string
  apiKey?: string
}

export type AIProvider = 'openai' | 'gemini' | 'openai-format'

export interface AnalysisResult {
  extractedText: string
  words: WordAnalysis[]
  grammar: GrammarPattern[]
  translation: string
  summary: string
  provider?: string
}

export interface OCRProgress {
  progress: number
  status: string
}

export const SUPPORTED_IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp']
}

export const DIFFICULTY_COLORS = {
  beginner: 'bg-green-100 text-green-800 border-green-200',
  intermediate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  advanced: 'bg-red-100 text-red-800 border-red-200'
} as const

export const cleanExtractedText = (text: string): string => {
  return text
    .trim()
    .replace(/\n\s*\n/g, '\n') // Remove extra line breaks
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .split('\n')
    .filter(line => line.length > 0)
    .join('\n')
}

export const formatJapaneseText = (text: string): string => {
  // Basic formatting for Japanese text display
  return text.replace(/([。！？])/g, '$1\n').trim()
}
