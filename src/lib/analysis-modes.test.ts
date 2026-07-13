import { describe, expect, it } from 'vitest'
import { ANALYSIS_MODE_OPTIONS, IMAGE_ANALYSIS_LANGUAGE_OPTIONS, IMAGE_ANALYSIS_PIPELINE } from './analysis-modes'

describe('analysis mode configuration', () => {
  it('exposes the image analyzer, mokuro reader, and text analyzer as selectable modes', () => {
    expect(ANALYSIS_MODE_OPTIONS.map(option => option.mode)).toEqual(['image', 'mokuro', 'text'])
    expect(ANALYSIS_MODE_OPTIONS.map(option => option.label)).toEqual([
      'Image Analyzer',
      'Mokuro Reader',
      'Text Analyzer'
    ])
    expect(ANALYSIS_MODE_OPTIONS.map(option => option.mode)).not.toContain('panel')
    expect(ANALYSIS_MODE_OPTIONS.map(option => option.mode)).not.toContain('simple')
    expect(ANALYSIS_MODE_OPTIONS.map(option => option.mode)).not.toContain('reading')
  })

  it('includes a text analyzer option with a short label', () => {
    const textOption = ANALYSIS_MODE_OPTIONS.find(o => o.mode === 'text')
    expect(textOption).toBeDefined()
    expect(textOption?.shortLabel).toBe('Text')
  })

  it('keeps image analysis as a single-page workflow without panel-by-panel steps', () => {
    expect(IMAGE_ANALYSIS_PIPELINE).toEqual([
      'reading-location-detection',
      'general-image-analysis'
    ])
    expect(IMAGE_ANALYSIS_PIPELINE).not.toContain('client-panel-segmentation')
    expect(IMAGE_ANALYSIS_PIPELINE).not.toContain('llm-panel-detection')
  })

  it('supports Chinese and English explanation language for image analysis', () => {
    expect(IMAGE_ANALYSIS_LANGUAGE_OPTIONS).toEqual(['zh', 'en'])
  })
})
