export interface WordAnalysis {
  word: string
  reading: string
  meaning: string
  partOfSpeech: string
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
}

export interface SavedWord {
  word: string
  reading: string
  meaning: string
  partOfSpeech: string
  difficulty: string
  sourceSentence: string | null
  savedAt: string
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

export interface APIKeySettings {
  openai?: string
}

export interface ModelSettings {
  openai: {
    model: string
  }
}

export type AIProvider = 'openai' | 'openai-format'
export type AnalysisLanguage = 'zh' | 'en'

export interface SentenceAnalysis {
  sentence: string
  translation: string
  words: WordAnalysis[]
  grammar: GrammarPattern[]
  context: string
}

export interface SentenceLocation {
  sentence: string
  translation: string
  words: WordAnalysis[]
  grammar: GrammarPattern[]
  context: string
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface ReadingModeResult {
  sentences: SentenceLocation[]
  imageData: string
  overallSummary: string
  provider?: string
}

export interface AnalysisResult {
  extractedText: string
  sentences: SentenceAnalysis[]
  translation: string
  summary: string
  provider: AIProvider
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

export interface MangaPanel {
  panelNumber: number
  position: {
    x: number
    y: number
    width: number
    height: number
  }
  imageData?: string // base64 encoded panel image
  extractedText: string
  sentences: SentenceAnalysis[]
  translation: string
  context: string
}

export interface MangaAnalysisResult {
  panels: MangaPanel[]
  overallSummary: string
  readingOrder?: number[]
  provider?: string
}

export interface MokuroBlock {
  box: [number, number, number, number]
  vertical: boolean
  font_size: number
  lines: string[]
  lines_coords?: unknown
}

export interface MokuroPage {
  version?: string
  img_width: number
  img_height: number
  blocks: MokuroBlock[]
  img_path: string
}

export interface MokuroFile {
  version?: string
  title?: string
  title_uuid?: string
  volume?: string
  volume_uuid?: string
  pages: MokuroPage[]
}

export interface MokuroAnalysisCacheFile {
  version: 1
  savedAt: string
  source: {
    title?: string
    pageCount?: number
  }
  analyses: Record<string, AnalysisResult>
}

export type AnalysisMode = 'image' | 'mokuro'

export interface PanelBoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface SegmentedPanel {
  id: string
  boundingBox: PanelBoundingBox
  imageData: string // base64 encoded panel image
  readingOrderIndex: number
}

export interface PanelSegmentationResult {
  panels: SegmentedPanel[]
  totalPanels: number
  originalImage: {
    width: number
    height: number
  }
  readingOrder: number[]
}
