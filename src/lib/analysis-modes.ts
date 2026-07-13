import type { AnalysisLanguage, AnalysisMode } from './types'

export interface AnalysisModeOption {
  mode: AnalysisMode
  label: string
  shortLabel: string
}

export const ANALYSIS_MODE_OPTIONS = [
  {
    mode: 'image',
    label: 'Image Analyzer',
    shortLabel: 'Image'
  },
  {
    mode: 'mokuro',
    label: 'Mokuro Reader',
    shortLabel: 'Mokuro'
  },
  {
    mode: 'text',
    label: 'Text Analyzer',
    shortLabel: 'Text'
  }
] as const satisfies readonly AnalysisModeOption[]

export const IMAGE_ANALYSIS_PIPELINE = [
  'reading-location-detection',
  'general-image-analysis'
] as const

export const IMAGE_ANALYSIS_LANGUAGE_OPTIONS = ['zh', 'en'] as const satisfies readonly AnalysisLanguage[]
