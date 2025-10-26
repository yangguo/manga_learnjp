import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider, OpenAIFormatSettings, ModelSettings, MangaAnalysisResult, PanelSegmentationResult, SegmentedPanel, MangaPanel, ReadingModeResult, SentenceLocation } from './types'
import { ClientPanelSegmentationService } from './client-panel-segmentation'
import { ImprovedTextDetectionService } from './improved-text-detection'
import { createImageDataURL, getImageMimeType, extractBase64FromDataURL } from './image-utils'
import { compressImageForAPI, isImageTooLarge } from './image-compression'

export interface AnalysisRequest {
  text: string
  provider?: AIProvider
}

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

export interface AnalysisResult {
  extractedText: string
  words: WordAnalysis[]
  grammar: GrammarPattern[]
  translation: string
  summary: string
  provider: AIProvider
}

const ANALYSIS_PROMPT = (text?: string) => `
You are a Japanese language learning assistant. ${text ? `Analyze the following Japanese text extracted from manga` : `Look at this manga image and extract all Japanese text, then analyze it`} and provide detailed explanations for language learners.

${text ? `Japanese Text:\n"${text}"` : ''}

Please provide a JSON response with the following structure:
{
  "extractedText": "${text ? text : 'All Japanese text found in the image'}",
  "sentences": [
    {
      "sentence": "Individual Japanese sentence",
      "translation": "English translation of this sentence",
      "words": [
        {
          "word": "Japanese word",
          "reading": "hiragana/katakana reading",
          "meaning": "English meaning",
          "partOfSpeech": "noun/verb/adjective/etc",
          "difficulty": "beginner/intermediate/advanced"
        }
      ],
      "grammar": [
        {
          "pattern": "Grammar pattern found in this sentence",
          "explanation": "Detailed explanation of the grammar pattern",
          "example": "Example sentence using this pattern"
        }
      ],
      "context": "Context or usage notes for this specific sentence"
    }
  ],
  "translation": "Overall English translation of all text",
  "summary": "Brief context summary explaining what's happening in this manga scene"
}

Focus on:
1. ${text ? 'First, split the text into individual sentences (including sound effects as separate items)' : 'First, accurately extracting ALL Japanese text from the manga image (including text in speech bubbles, sound effects, signs, etc.) and split into sentences'} 
2. Analyze each sentence individually for vocabulary and grammar
3. Breaking down important vocabulary words, especially those that might be difficult for learners
4. Identifying key grammar patterns and structures in each sentence
5. Providing context for manga-specific language or expressions
6. Assigning appropriate difficulty levels (beginner: JLPT N5-N4, intermediate: N3-N2, advanced: N1+)
7. Including furigana readings for kanji
8. Explaining any colloquialisms, slang, or casual speech patterns common in manga
9. ${text ? 'Recognizing sentence boundaries properly (。！？ etc.)' : 'Recognizing manga sound effects (onomatopoeia) and their meanings as separate sentence items'}
10. Provide both sentence-level analysis AND overall summary analysis

Make sure the response is valid JSON format.`

const MANGA_PANEL_ANALYSIS_PROMPT = () => `
You are a Japanese language learning assistant specialized in manga analysis. Analyze this manga image by identifying individual panels and extracting text from each panel separately.

IMPORTANT: Manga panels are read from RIGHT to LEFT, TOP to BOTTOM. Please identify panels in the correct reading order.

Please provide a JSON response with the following structure:
{
  "panels": [
    {
      "panelNumber": 1,
      "position": {
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 100
      },
      "extractedText": "Japanese text from this specific panel",
      "sentences": [
        {
          "sentence": "Individual Japanese sentence from this panel",
          "translation": "English translation of this sentence",
          "words": [
            {
              "word": "Japanese word",
              "reading": "hiragana/katakana reading",
              "meaning": "English meaning",
              "partOfSpeech": "noun/verb/adjective/etc",
              "difficulty": "beginner/intermediate/advanced"
            }
          ],
          "grammar": [
            {
              "pattern": "Grammar pattern found in this sentence",
              "explanation": "Detailed explanation of the grammar pattern",
              "example": "Example sentence using this pattern"
            }
          ],
          "context": "Context or usage notes for this specific sentence"
        }
      ],
      "translation": "English translation of this panel's text",
      "context": "What's happening in this specific panel"
    }
  ],
  "overallSummary": "Overall summary of the entire manga page/scene",
  "readingOrder": [1, 2, 3, 4]
}

Focus on:
1. Identifying individual manga panels (speech bubbles, panel borders, distinct scenes)
2. Reading order: RIGHT to LEFT, TOP to BOTTOM (traditional Japanese manga layout)
3. Extracting text from each panel separately and splitting into individual sentences
4. Analyzing each sentence individually for vocabulary and grammar
5. Analyzing vocabulary and grammar for each panel individually (summary level)
6. Providing context for each panel's content and individual sentences
7. Including sound effects (onomatopoeia) and their meanings as separate sentence items
8. Recognizing different types of text (dialogue, thoughts, narration, sound effects)
9. Difficulty levels: beginner (JLPT N5-N4), intermediate (N3-N2), advanced (N1+)
10. Proper sentence boundary recognition (。！？ etc.)

Make sure the response is valid JSON format.`

// Shortened prompt for providers with response length limits
const CONCISE_ANALYSIS_PROMPT = (text?: string) => `
You are a Japanese language learning assistant. ${text ? `Analyze this Japanese text` : `Extract and analyze Japanese text from this image`}.

${text ? `Text: "${text}"` : ''}

Provide concise JSON response:
{
  "extractedText": "${text ? text : 'Japanese text from image'}",
  "sentences": [
    {
      "sentence": "Japanese sentence",
      "translation": "English translation",
      "words": [{"word": "word", "reading": "reading", "meaning": "meaning", "partOfSpeech": "pos", "difficulty": "level"}],
      "grammar": [{"pattern": "pattern", "explanation": "brief explanation", "example": "example"}],
      "context": "brief context"
    }
  ],
  "translation": "Overall translation",
  "summary": "Brief summary"
}

IMPORTANT: Keep responses under 5000 characters. Be concise but accurate.`

// Concise manga panel analysis prompt for providers with response length limits
const CONCISE_MANGA_PANEL_ANALYSIS_PROMPT = () => `
Analyze this manga image. Identify panels in RIGHT-to-LEFT, TOP-to-BOTTOM order.

Provide concise JSON:
{
  "panels": [
    {
      "panelNumber": 1,
      "position": {"x": 0, "y": 0, "width": 100, "height": 100},
      "extractedText": "Japanese text from panel",
      "sentences": [
        {
          "sentence": "Japanese sentence",
          "translation": "English translation",
          "words": [{"word": "word", "reading": "reading", "meaning": "meaning", "partOfSpeech": "pos", "difficulty": "level"}],
          "grammar": [{"pattern": "pattern", "explanation": "brief explanation", "example": "example"}],
          "context": "brief context"
        }
      ],
      "translation": "Panel translation",
      "context": "Brief panel context"
    }
  ]
}

IMPORTANT: Keep under 5000 characters. Be concise but accurate.`

// Utility functions for text batching and sentence splitting
function splitTextIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return []
  }
  
  // Japanese sentence endings: period, exclamation, question mark
  // Also handle special cases like ellipsis, tilde, etc.
  const sentenceEndings = /[。！？…～♪♫]/
  
  // Split by sentence endings but keep the ending character
  const sentences: string[] = []
  let currentSentence = ''
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    currentSentence += char
    
    if (sentenceEndings.test(char)) {
      // Found sentence ending
      sentences.push(currentSentence.trim())
      currentSentence = ''
    }
  }
  
  // Add remaining text as a sentence if it exists
  if (currentSentence.trim().length > 0) {
    sentences.push(currentSentence.trim())
  }
  
  // Filter out empty sentences and very short ones (likely artifacts)
  return sentences.filter(s => s.trim().length > 0)
}

function createTextBatches(sentences: string[], maxBatchSize: number = 3): string[][] {
  const batches: string[][] = []
  
  for (let i = 0; i < sentences.length; i += maxBatchSize) {
    const batch = sentences.slice(i, i + maxBatchSize)
    batches.push(batch)
  }
  
  return batches
}

function combineBatchResults(batchResults: any[]): any {
  if (batchResults.length === 0) {
    throw new Error('No batch results to combine')
  }
  
  if (batchResults.length === 1) {
    return batchResults[0]
  }
  
  // Combine all sentences from all batches
  const allSentences: any[] = []
  const translations: string[] = []
  const extractedTexts: string[] = []
  
  for (const result of batchResults) {
    if (result.sentences && Array.isArray(result.sentences)) {
      allSentences.push(...result.sentences)
    }
    if (result.translation) {
      translations.push(result.translation)
    }
    if (result.extractedText) {
      extractedTexts.push(result.extractedText)
    }
  }
  
  return {
    extractedText: extractedTexts.join(''),
    sentences: allSentences,
    translation: translations.join(' '),
    summary: `Combined analysis of ${allSentences.length} sentences from ${batchResults.length} batches.`,
    provider: batchResults[0]?.provider || 'unknown'
  }
}

// Helper function to clean JSON responses that might be wrapped in markdown
function cleanJsonResponse(content: string): string {
  if (!content) return ''
  
  // Remove markdown code block wrappers if present
  let cleaned = content.trim()
  
  // Handle multiple patterns of markdown code blocks
  const patterns = [
    /```(?:json)?\s*([\s\S]*?)\s*```/g,  // Standard markdown blocks
    /```\s*([\s\S]*?)\s*```/g,           // Generic code blocks
    /`{3,}\s*json\s*([\s\S]*?)`{3,}/gi,  // Variations with json label
    /`{3,}\s*([\s\S]*?)`{3,}/g           // Generic triple backticks
  ]
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match) {
      // Extract the content between code blocks
      cleaned = match[0].replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      break
    }
  }
  
  // Remove any remaining backticks at the start or end
  cleaned = cleaned.replace(/^`+|`+$/g, '').trim()
  
  // Find JSON content by looking for opening and closing braces
  const jsonStart = cleaned.indexOf('{')
  if (jsonStart === -1) {
    return cleaned // No JSON found, return as is
  }
  
  // Count braces to find the matching closing brace
  let braceCount = 0
  let jsonEnd = -1
  let inString = false
  let escapeNext = false
  
  for (let i = jsonStart; i < cleaned.length; i++) {
    const char = cleaned[i]
    
    if (escapeNext) {
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      escapeNext = true
      continue
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0) {
          jsonEnd = i
          break
        }
      }
    }
  }
  
  if (jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
  } else {
    // If we can't find matching braces, try the old method as fallback
    const lastBrace = cleaned.lastIndexOf('}')
    if (lastBrace > jsonStart) {
      cleaned = cleaned.substring(jsonStart, lastBrace + 1)
    }
  }
  
  return cleaned
}

type NormalizedBoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

function sanitizeCoordinate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const compact = trimmed.replace(/[\s,]/g, '')
    const match = compact.match(/[+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?/)
    if (!match) return null
    const parsed = Number.parseFloat(match[0])
    return Number.isFinite(parsed) ? parsed : null
  }
  
  return null
}

function normalizeBoundingBox(rawBoundingBox: any): NormalizedBoundingBox | null {
  if (!rawBoundingBox) {
    return null
  }

  const clamp = (value: number) => {
    if (!Number.isFinite(value)) return 0
    if (value < 0) return 0
    return value
  }

  const ensurePositive = (value: number | null) => {
    if (value === null) return null
    if (!Number.isFinite(value)) return null
    return Math.abs(value)
  }

  const computeDimension = (start: number | null, end: number | null): number | null => {
    if (start === null || end === null) return null
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    if (end === start) return null
    return Math.abs(end - start)
  }

  const flattenArray = (value: unknown): number[] => {
    if (!Array.isArray(value)) return []
    return value.flatMap(item => {
      if (Array.isArray(item)) {
        return flattenArray(item)
      }
      const sanitized = sanitizeCoordinate(item)
      return sanitized === null ? [] : [sanitized]
    })
  }

  const buildBoundingBoxFromPoints = (points: Array<{ x: number, y: number }>): NormalizedBoundingBox | null => {
    if (points.length === 0) return null

    const xs = points.map(point => point.x)
    const ys = points.map(point => point.y)

    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)

    const width = ensurePositive(maxX - minX)
    const height = ensurePositive(maxY - minY)

    if (width === null || height === null || width === 0 || height === 0) {
      return null
    }

    return {
      x: clamp(minX),
      y: clamp(minY),
      width: clamp(width),
      height: clamp(height)
    }
  }

  const attemptFromPoints = (maybePoints: unknown): NormalizedBoundingBox | null => {
    if (!Array.isArray(maybePoints)) return null
    const parsedPoints: Array<{ x: number, y: number }> = []
    let sawStructuredPoint = false

    maybePoints.forEach(point => {
      if (!point) return
      if (Array.isArray(point) && point.length >= 2) {
        sawStructuredPoint = true
        const px = sanitizeCoordinate(point[0])
        const py = sanitizeCoordinate(point[1])
        if (px !== null && py !== null) {
          parsedPoints.push({ x: px, y: py })
        }
        return
      }
      if (typeof point === 'object') {
        sawStructuredPoint = true
        const px = sanitizeCoordinate((point as any).x ?? (point as any)[0])
        const py = sanitizeCoordinate((point as any).y ?? (point as any)[1])
        if (px !== null && py !== null) {
          parsedPoints.push({ x: px, y: py })
        }
        return
      }
    })

    if (parsedPoints.length > 0) {
      return buildBoundingBoxFromPoints(parsedPoints)
    }

    if (!sawStructuredPoint) {
      const numericValues = maybePoints
        .map(value => sanitizeCoordinate(value))
        .filter((value): value is number => value !== null)

      if (numericValues.length >= 6 && numericValues.length % 2 === 0) {
        for (let i = 0; i < numericValues.length; i += 2) {
          const px = numericValues[i]
          const py = numericValues[i + 1]
          if (px !== undefined && py !== undefined) {
            parsedPoints.push({ x: px, y: py })
          }
        }
        if (parsedPoints.length > 0) {
          return buildBoundingBoxFromPoints(parsedPoints)
        }
      }
    }

    return null
  }

  const interpretObject = (input: Record<string, unknown>): NormalizedBoundingBox | null => {
    let x = sanitizeCoordinate(input.x ?? input.left ?? input.l ?? input.minX)
    let y = sanitizeCoordinate(input.y ?? input.top ?? input.t ?? input.minY)
    let width = sanitizeCoordinate(input.width ?? input.w)
    let height = sanitizeCoordinate(input.height ?? input.h)

    let pointSource = input.points ?? input.corners ?? input.vertices ?? input.boundingPoly
    if (pointSource && !Array.isArray(pointSource) && typeof pointSource === 'object') {
      pointSource =
        (pointSource as any).points ??
        (pointSource as any).vertices ??
        (pointSource as any).coords ??
        (pointSource as any).coordinates ??
        Object.values(pointSource).find(Array.isArray)
    }

    const fromPoints = attemptFromPoints(pointSource)
    if (!Number.isFinite(x ?? NaN) || !Number.isFinite(y ?? NaN)) {
      if (fromPoints) {
        return fromPoints
      }
    }

    if (width === null || height === null) {
      const right = sanitizeCoordinate(input.right ?? input.x2 ?? input.maxX ?? input.xr ?? input.longitudeMax)
      const bottom = sanitizeCoordinate(input.bottom ?? input.y2 ?? input.maxY ?? input.yb ?? input.latitudeMax)

      if (width === null) {
        width = computeDimension(x, right)
      }
      if (height === null) {
        height = computeDimension(y, bottom)
      }
    }

    if ((width === null || height === null) && Array.isArray(input.bbox)) {
      const bboxValues = flattenArray(input.bbox)
      if (bboxValues.length >= 4) {
        const maybeX = bboxValues[0]
        const maybeY = bboxValues[1]
        const maybeWidth = bboxValues[2]
        const maybeHeight = bboxValues[3]

        if (x === null) x = maybeX
        if (y === null) y = maybeY
        if (width === null) width = maybeWidth
        if (height === null) height = maybeHeight
      }
    }

    if ((width === null || height === null) && Array.isArray(input.size)) {
      const [w, h] = flattenArray(input.size)
      if (width === null && w !== undefined) width = w
      if (height === null && h !== undefined) height = h
    }

    if ((width === null || height === null) && fromPoints) {
      if (x === null) x = fromPoints.x
      if (y === null) y = fromPoints.y
      if (width === null) width = fromPoints.width
      if (height === null) height = fromPoints.height
    }

    if (x === null || y === null || width === null || height === null) {
      return null
    }

    width = ensurePositive(width)
    height = ensurePositive(height)

    if (width === null || height === null || width === 0 || height === 0) {
      return null
    }

    return {
      x: clamp(x),
      y: clamp(y),
      width: clamp(width),
      height: clamp(height)
    }
  }

  if (Array.isArray(rawBoundingBox)) {
    const flatValues = flattenArray(rawBoundingBox)
    const hasStructuredPointEntries = rawBoundingBox.some(item => {
      if (!item) return false
      if (Array.isArray(item)) return true
      return typeof item === 'object'
    })

    const interpretAsWidthHeight = (): NormalizedBoundingBox | null => {
      if (flatValues.length < 4) {
        return null
      }

      const rawX = flatValues[0]
      const rawY = flatValues[1]
      const rawThird = flatValues[2]
      const rawFourth = flatValues[3]

      if (rawX === undefined || rawY === undefined) {
        return null
      }

      const x = rawX
      const y = rawY
      
      let width: number | null = null
      let height: number | null = null

      if (rawThird !== undefined && rawFourth !== undefined) {
        const directWidth = ensurePositive(rawThird)
        const directHeight = ensurePositive(rawFourth)
        const derivedWidth = computeDimension(x ?? null, rawThird ?? null)
        const derivedHeight = computeDimension(y ?? null, rawFourth ?? null)

        if (derivedWidth !== null && derivedHeight !== null && derivedWidth > 0 && derivedHeight > 0) {
          if (directWidth !== null && directHeight !== null && directWidth > 0 && directHeight > 0) {
            if (directWidth <= 1.0001 && directHeight <= 1.0001) {
              width = directWidth
              height = directHeight
            } else if (directWidth <= 100.0001 && directHeight <= 100.0001) {
              width = directWidth
              height = directHeight
            } else {
              width = derivedWidth
              height = derivedHeight
            }
          } else {
            width = derivedWidth
            height = derivedHeight
          }
        } else if (directWidth !== null && directHeight !== null && directWidth > 0 && directHeight > 0) {
          width = directWidth
          height = directHeight
        }
      }

      if (width === null || height === null || width <= 0 || height <= 0) {
        return null
      }

      return {
        x: clamp(x),
        y: clamp(y),
        width: clamp(width),
        height: clamp(height)
      }
    }

    const shouldTryPointsFirst = hasStructuredPointEntries || flatValues.length > 4

    if (!shouldTryPointsFirst) {
      const directBox = interpretAsWidthHeight()
      if (directBox) {
        return directBox
      }
    }

    const fromPoints = attemptFromPoints(rawBoundingBox)
    if (fromPoints) {
      return fromPoints
    }

    const fallbackBox = interpretAsWidthHeight()
    if (fallbackBox) {
      return fallbackBox
    }

    return null
  }

  if (typeof rawBoundingBox === 'object') {
    return interpretObject(rawBoundingBox as Record<string, unknown>)
  }

  return null
}

// Helper function to validate and parse JSON with better error handling
function parseJsonSafely(content: string, source: string = 'unknown', skipValidation: boolean = false): any {
  const attemptParse = (input: string, validationSource: string) => {
    const parsed = JSON.parse(input)
    if (!skipValidation) {
      validateAnalysisResult(parsed, validationSource)
    }
    return parsed
  }
  
  try {
    return attemptParse(content, source)
  } catch (initialError) {
    const errorMessage = initialError instanceof Error ? initialError.message : 'Unknown error'
    console.warn(`Malformed JSON received from ${source}: ${errorMessage}. Applying repair heuristics.`)
    
    // Try to reconstruct truncated or slightly malformed JSON
    let fixedContent = content.trim()
    
    // Fix common LLM mistake: unescaped quotes in example fields with arrows
    // Pattern: "example": "Japanese text" → "English text"
    // Should be: "example": "Japanese text → \"English text\""
    fixedContent = fixedContent.replace(
      /"(example|pattern)":\s*"([^"]*?)"\s*→\s*"([^"]*?)"/g,
      '"$1": "$2 → \\"$3\\""'
    )
    
    // Remove trailing commas before closing brackets/braces
    fixedContent = fixedContent.replace(/,(\s*[}\]])/g, '$1')
    
    // Fix incomplete array elements by removing trailing content after last complete object
    const lastValidObjectEnd = findLastCompleteJsonStructure(fixedContent)
    if (lastValidObjectEnd) {
      console.warn(`Detected truncated JSON in ${source}, attempting reconstruction.`)
      fixedContent = lastValidObjectEnd
    } else {
      // Try other common fixes for incomplete structures
      
      // Fix incomplete arrays by closing them at the last valid position
      if (fixedContent.includes('[') && !fixedContent.trim().endsWith(']')) {
        const lastCompleteArrayElement = findLastCompleteArrayElement(fixedContent)
        if (lastCompleteArrayElement) {
          fixedContent = lastCompleteArrayElement + ']'
        } else {
          fixedContent += ']'
        }
      }
      
      // Balance braces for incomplete objects
      const openBraces = (fixedContent.match(/{/g) || []).length
      const closeBraces = (fixedContent.match(/}/g) || []).length
      
      if (openBraces > closeBraces) {
        fixedContent += '}'.repeat(openBraces - closeBraces)
      }
      
      // Balance brackets for incomplete arrays
      const openBrackets = (fixedContent.match(/\[/g) || []).length
      const closeBrackets = (fixedContent.match(/\]/g) || []).length
      
      if (openBrackets > closeBrackets) {
        fixedContent += ']'.repeat(openBrackets - closeBrackets)
      }
    }
    
    try {
      const repairedResult = attemptParse(fixedContent, `${source} (fixed)`)
      console.warn(`Successfully repaired malformed JSON response from ${source}.`)
      return repairedResult
    } catch (secondError) {
      console.error(`JSON parsing error in ${source}:`, secondError)
      console.error('Content length:', content.length)
      console.error('Content preview (first 500 chars):', content.substring(0, 500))
      console.error('Content preview (last 500 chars):', content.substring(Math.max(0, content.length - 500)))
      
      // Last resort: try to extract partial data
      const partialResult = extractPartialJsonData(content)
      if (partialResult) {
        console.warn(`Using partial JSON extraction as fallback for ${source}.`)
        return partialResult
      }
      
      throw new Error(`Failed to parse JSON from ${source}: ${errorMessage}`)
    }
  }
}

// Helper function to find the last complete JSON object in truncated content
function findLastCompleteJsonObject(content: string): string | null {
  const jsonStart = content.indexOf('{')
  if (jsonStart === -1) return null
  
  let braceCount = 0
  let inString = false
  let escapeNext = false
  let lastValidEnd = -1
  
  for (let i = jsonStart; i < content.length; i++) {
    const char = content[i]
    
    if (escapeNext) {
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      escapeNext = true
      continue
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0) {
          lastValidEnd = i
          // Continue to see if there are more complete objects
        }
      }
    }
  }
  
  if (lastValidEnd !== -1) {
    return content.substring(jsonStart, lastValidEnd + 1)
  }
  
  return null
}

// Helper function to find the last complete JSON structure (object or array)
function findLastCompleteJsonStructure(content: string): string | null {
  // First try to find complete object
  const completeObject = findLastCompleteJsonObject(content)
  if (completeObject) return completeObject
  
  // If no complete object, try to find complete array elements
  const arrayStart = content.indexOf('[')
  if (arrayStart === -1) return null
  
  let inString = false
  let escapeNext = false
  let braceCount = 0
  let bracketCount = 0
  let lastValidArrayEnd = -1
  
  for (let i = arrayStart; i < content.length; i++) {
    const char = content[i]
    
    if (escapeNext) {
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      escapeNext = true
      continue
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }
    
    if (!inString) {
      if (char === '{') {
        braceCount++
      } else if (char === '}') {
        braceCount--
      } else if (char === '[') {
        bracketCount++
      } else if (char === ']') {
        bracketCount--
        if (bracketCount === 0) {
          lastValidArrayEnd = i
        }
      }
    }
  }
  
  if (lastValidArrayEnd !== -1) {
    return content.substring(0, lastValidArrayEnd + 1)
  }
  
  return null
}

// Helper function to find the last complete array element
function findLastCompleteArrayElement(content: string): string | null {
  const arrayStart = content.indexOf('[')
  if (arrayStart === -1) return null
  
  let inString = false
  let escapeNext = false
  let braceCount = 0
  let lastCompleteElementEnd = -1
  let elementStart = -1
  
  for (let i = arrayStart + 1; i < content.length; i++) {
    const char = content[i]
    
    if (escapeNext) {
      escapeNext = false
      continue
    }
    
    if (char === '\\') {
      escapeNext = true
      continue
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }
    
    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) {
          elementStart = i
        }
        braceCount++
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0 && elementStart !== -1) {
          lastCompleteElementEnd = i
        }
      }
    }
  }
  
  if (lastCompleteElementEnd !== -1) {
    return content.substring(0, lastCompleteElementEnd + 1)
  }
  
  return null
}

// Helper function to extract partial data from malformed JSON
function extractPartialJsonData(content: string): any | null {
  try {
    // Check if this looks like a manga analysis (has "panels" field)
    const isMangaAnalysis = content.includes('"panels"')
    
    if (isMangaAnalysis) {
      return extractPartialMangaData(content)
    } else {
      return extractPartialTextData(content)
    }
  } catch (e) {
    console.error('Failed to extract partial data:', e)
  }
  
  return null
}

// Extract partial data for regular text analysis
function extractPartialTextData(content: string): any | null {
  try {
    // Try to extract basic fields even from incomplete JSON
    const extractedTextMatch = content.match(/"extractedText":\s*"([^"]*)"/)
    const extractedText = extractedTextMatch ? extractedTextMatch[1] : ''
    
    // Try to extract complete sentences that were parsed
    const sentencesMatch = content.match(/"sentences":\s*\[([\s\S]*?)(?:\]|$)/)
    const sentences: any[] = []
    
    if (sentencesMatch) {
      const sentencesContent = sentencesMatch[1]
      let braceCount = 0
      let inString = false
      let escapeNext = false
      let sentenceStart = -1
      
      for (let i = 0; i < sentencesContent.length; i++) {
        const char = sentencesContent[i]
        
        if (escapeNext) {
          escapeNext = false
          continue
        }
        
        if (char === '\\') {
          escapeNext = true
          continue
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString
          continue
        }
        
        if (!inString) {
          if (char === '{') {
            if (braceCount === 0) {
              sentenceStart = i
            }
            braceCount++
          } else if (char === '}') {
            braceCount--
            if (braceCount === 0 && sentenceStart !== -1) {
              const sentenceJson = sentencesContent.substring(sentenceStart, i + 1)
              try {
                const sentenceObj = JSON.parse(sentenceJson)
                if (sentenceObj.sentence && sentenceObj.translation) {
                  sentences.push({
                    sentence: sentenceObj.sentence,
                    translation: sentenceObj.translation,
                    words: Array.isArray(sentenceObj.words) ? sentenceObj.words : [],
                    grammar: Array.isArray(sentenceObj.grammar) ? sentenceObj.grammar : [],
                    context: sentenceObj.context || 'Analysis incomplete due to truncated response',
                    boundingBox: sentenceObj.boundingBox
                  })
                }
              } catch {
                // Ignore malformed sentence fragments
              }
              sentenceStart = -1
            }
          }
        }
      }
    }
    
    if (extractedText || sentences.length > 0) {
      return {
        extractedText: extractedText,
        sentences: sentences,
        translation: extractedText ? `Partial translation (truncated response)` : 'Analysis incomplete',
        summary: 'Analysis was truncated due to response length limits. Some data may be incomplete.',
        provider: 'openai-format'
      }
    }
  } catch (e) {
    console.error('Failed to extract partial text data:', e)
  }
  
  return null
}

// Extract partial data for manga analysis
function extractPartialMangaData(content: string): any | null {
  try {
    const panels: any[] = []
    
    // Try to extract panels array content
    const panelsMatch = content.match(/"panels":\s*\[([\s\S]*?)(?:\]|$)/)
    if (panelsMatch) {
      const panelsContent = panelsMatch[1]
      
      // Find complete panel objects using a more robust approach
      let braceCount = 0
      let inString = false
      let escapeNext = false
      let panelStart = -1
      let currentPos = 0
      
      for (let i = 0; i < panelsContent.length; i++) {
        const char = panelsContent[i]
        
        if (escapeNext) {
          escapeNext = false
          continue
        }
        
        if (char === '\\') {
          escapeNext = true
          continue
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString
          continue
        }
        
        if (!inString) {
          if (char === '{') {
            if (braceCount === 0) {
              panelStart = i
            }
            braceCount++
          } else if (char === '}') {
            braceCount--
            if (braceCount === 0 && panelStart !== -1) {
              // Found a complete panel object
              const panelJson = panelsContent.substring(panelStart, i + 1)
              try {
                const panel = JSON.parse(panelJson)
                if (panel.panelNumber && panel.extractedText !== undefined) {
                  // Fill in missing fields with defaults
                  panels.push({
                    panelNumber: panel.panelNumber,
                    position: panel.position || { x: 0, y: 0, width: 100, height: 100 },
                    extractedText: panel.extractedText || '',
                    sentences: panel.sentences || [],
                    translation: panel.translation || 'Translation incomplete',
                    context: panel.context || 'Analysis incomplete due to truncated response'
                  })
                }
              } catch (e) {
                // Skip malformed panel objects
              }
              panelStart = -1
            }
          }
        }
      }
    }
    
    if (panels.length > 0) {
      return {
        panels: panels,
        overallSummary: `Partial analysis recovered ${panels.length} panel(s). Some data may be incomplete due to truncated response.`,
        readingOrder: panels.map((_, index) => index + 1),
        provider: 'openai-format'
      }
    }
  } catch (e) {
    console.error('Failed to extract partial manga data:', e)
  }
  
  return null
}

// Helper function to validate the structure of analysis results
function validateAnalysisResult(result: any, source: string): boolean {
  if (!result || typeof result !== 'object') {
    console.warn(`${source}: Result is not an object`, result)
    return false
  }

  const requiredFields = ['extractedText', 'sentences', 'translation', 'summary']
  const missingFields = requiredFields.filter(field => !(field in result))
  
  if (missingFields.length > 0) {
    console.warn(`${source}: Missing required fields:`, missingFields)
    console.warn(`${source}: Available fields:`, Object.keys(result))
  }

  // Check sentences structure
  if (result.sentences && Array.isArray(result.sentences)) {
    const invalidSentences = result.sentences.filter((sentence: any, index: number) => {
      const sentenceFields = ['sentence', 'translation', 'words', 'grammar', 'context']
      const missingSentenceFields = sentenceFields.filter(field => !(field in sentence))
      if (missingSentenceFields.length > 0) {
        console.warn(`${source}: Sentence ${index} missing fields:`, missingSentenceFields)
        return true
      }
      return false
    })
    
    if (invalidSentences.length > 0) {
      console.warn(`${source}: Found ${invalidSentences.length} invalid sentences`)
    }
  } else {
    console.warn(`${source}: sentences field is not an array or missing`)
  }

  return missingFields.length === 0
}

// Helper function to validate the structure of manga analysis results
function validateMangaAnalysisResult(result: any, source: string): boolean {
  if (!result || typeof result !== 'object') {
    console.warn(`${source}: Result is not an object`, result)
    return false
  }

  // Check for panels structure
  if (!result.panels || !Array.isArray(result.panels)) {
    console.warn(`${source}: panels field is not an array or missing`)
    return false
  }

  // Validate each panel structure
  const invalidPanels = result.panels.filter((panel: any, index: number) => {
    const panelFields = ['panelNumber', 'position', 'extractedText', 'sentences', 'translation']
    const missingPanelFields = panelFields.filter(field => !(field in panel))
    if (missingPanelFields.length > 0) {
      console.warn(`${source}: Panel ${index} missing fields:`, missingPanelFields)
      return true
    }

    // Check sentences structure within panel
    if (panel.sentences && Array.isArray(panel.sentences)) {
      const invalidSentences = panel.sentences.filter((sentence: any, sentenceIndex: number) => {
        const sentenceFields = ['sentence', 'translation', 'words', 'grammar', 'context']
        const missingSentenceFields = sentenceFields.filter(field => !(field in sentence))
        if (missingSentenceFields.length > 0) {
          console.warn(`${source}: Panel ${index}, Sentence ${sentenceIndex} missing fields:`, missingSentenceFields)
          return true
        }
        return false
      })
      
      if (invalidSentences.length > 0) {
        console.warn(`${source}: Panel ${index} has ${invalidSentences.length} invalid sentences`)
      }
    }
    
    return false
  })
  
  if (invalidPanels.length > 0) {
    console.warn(`${source}: Found ${invalidPanels.length} invalid panels`)
  }

  return invalidPanels.length === 0
}

export class OpenAIService {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey
    this.model = model || process.env.OPENAI_MODEL || 'gpt-4-vision-preview'
  }

  async analyzeText(text: string): Promise<AnalysisResult> {
    // Split text into sentences for batching
    const sentences = splitTextIntoSentences(text)
    console.log(`OpenAI analyzeText: Split text into ${sentences.length} sentences`)
    
    // If we have few sentences, analyze all at once
    if (sentences.length <= 3) {
      return this.analyzeSingleBatch(text)
    }
    
    // Create batches for longer texts
    const batches = createTextBatches(sentences, 3) // 3 sentences per batch
    console.log(`OpenAI analyzeText: Created ${batches.length} batches`)
    
    const batchResults: any[] = []
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchText = batch.join('')
      console.log(`OpenAI analyzeText: Processing batch ${i + 1}/${batches.length} with ${batch.length} sentences`)
      
      try {
        const batchResult = await this.analyzeSingleBatch(batchText)
        batchResults.push(batchResult)
      } catch (error) {
        console.error(`OpenAI analyzeText: Error processing batch ${i + 1}:`, error)
        // Continue with other batches rather than failing completely
      }
    }
    
    if (batchResults.length === 0) {
      throw new Error('All batches failed to process')
    }
    
    // Combine results from all batches
    const combinedResult = combineBatchResults(batchResults)
    console.log(`OpenAI analyzeText: Combined ${batchResults.length} batch results into final result`)
    
    return {
      ...combinedResult,
      provider: 'openai' as AIProvider
    }
  }

  private async analyzeSingleBatch(text: string): Promise<AnalysisResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful Japanese language learning assistant that provides detailed analysis of Japanese text for learners. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: ANALYSIS_PROMPT(text)
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI')
    }

    try {
      const cleanedContent = cleanJsonResponse(content)
      console.log('OpenAI analyzeSingleBatch cleaned content preview:', cleanedContent.substring(0, 200) + '...')
      const analysisResult = parseJsonSafely(cleanedContent, 'OpenAI analyzeSingleBatch')
      
      // Validate the structure of the analysis result
      const isValid = validateAnalysisResult(analysisResult, 'OpenAI analyzeSingleBatch')
      if (!isValid) {
        throw new Error('Invalid analysis result structure')
      }
      
      return {
        ...analysisResult,
        provider: 'openai' as AIProvider
      }
    } catch (error) {
      console.error('OpenAI analyzeSingleBatch JSON parsing error:', error)
      console.error('Raw content:', content.substring(0, 500) + '...')
      throw new Error(`Failed to parse OpenAI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async analyzeImage(imageBase64: string): Promise<AnalysisResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful Japanese language learning assistant that can read Japanese text from manga images and provide detailed analysis for learners. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: ANALYSIS_PROMPT()
              },
              {
                type: 'image_url',
                image_url: {
                  url: createImageDataURL(imageBase64)
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI')
    }

    try {
      const cleanedContent = cleanJsonResponse(content)
      console.log('OpenAI analyzeImage cleaned content preview:', cleanedContent.substring(0, 200) + '...')
      const analysisResult = parseJsonSafely(cleanedContent, 'OpenAI analyzeImage')
      
      // Validate the structure of the analysis result
      const isValid = validateAnalysisResult(analysisResult, 'OpenAI analyzeImage')
      if (!isValid) {
        throw new Error('Invalid analysis result structure')
      }
      
      return {
        ...analysisResult,
        provider: 'openai' as AIProvider
      }
    } catch (error) {
      console.error('OpenAI analyzeImage JSON parsing error:', error)
      console.error('Raw content:', content.substring(0, 500) + '...')
      throw new Error(`Failed to parse OpenAI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async analyzeMangaImage(imageBase64: string): Promise<MangaAnalysisResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful Japanese language learning assistant specialized in manga analysis. You can identify manga panels and extract text from each panel separately following traditional right-to-left, top-to-bottom reading order. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: MANGA_PANEL_ANALYSIS_PROMPT()
              },
              {
                type: 'image_url',
                image_url: {
                  url: createImageDataURL(imageBase64)
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI')
    }

    try {
      const cleanedContent = cleanJsonResponse(content)
      console.log('OpenAI analyzeMangaImage cleaned content preview:', cleanedContent.substring(0, 200) + '...')
      const analysisResult = parseJsonSafely(cleanedContent, 'OpenAI analyzeMangaImage', true)
      
      // Skip validation for simple analysis mode to be more lenient
      // const isValid = validateMangaAnalysisResult(analysisResult, 'OpenAI analyzeMangaImage')
      // if (!isValid) {
      //   throw new Error('Invalid manga analysis result structure')
      // }
      
      // Ensure we have a proper readingOrder
      const readingOrder = analysisResult.readingOrder || (analysisResult.panels ? analysisResult.panels.map((_: any, index: number) => index + 1) : [])
      
      return {
        ...analysisResult,
        readingOrder,
        provider: 'openai' as AIProvider
      }
    } catch (error) {
      console.error('OpenAI analyzeMangaImage JSON parsing error:', error)
      console.error('Raw content:', content.substring(0, 500) + '...')
      throw new Error(`Failed to parse OpenAI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async analyzeImageForReading(imageBase64: string): Promise<any> {
    console.log('📖 OpenAI: Starting two-step reading mode analysis')
    
    // Step 1: Vision model to detect text and bounding boxes
    const TEXT_DETECTION_PROMPT = `
Analyze this manga image and identify ALL Japanese text with their precise locations.

For each text segment found, provide:
1. The exact Japanese text (character by character)
2. Precise bounding box coordinates (x, y, width, height) as percentages (0-100) of image dimensions

Provide a JSON response:
{
  "textSegments": [
    {
      "text": "Japanese text",
      "boundingBox": {
        "x": 10.5,
        "y": 20.3,
        "width": 25.7,
        "height": 8.2
      }
    }
  ]
}

IMPORTANT:
- Include ALL text: speech bubbles, sound effects, signs, narration
- Coordinates are percentages (0-100) relative to image dimensions
- Each distinct text area should be a separate segment
- Be precise with bounding boxes to cover the entire text area
`

    console.log('🔍 Step 1: Detecting text and locations...')
    const detectionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a vision model specialized in detecting Japanese text and precise locations in manga images. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: TEXT_DETECTION_PROMPT
              },
              {
                type: 'image_url',
                image_url: {
                  url: createImageDataURL(imageBase64)
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    })

    if (!detectionResponse.ok) {
      throw new Error(`OpenAI API error (detection): ${detectionResponse.status}`)
    }

    const detectionData = await detectionResponse.json()
    const detectionContent = detectionData.choices[0]?.message?.content

    if (!detectionContent) {
      throw new Error('No content received from OpenAI detection')
    }

    const cleanedDetection = cleanJsonResponse(detectionContent)
    const detectionResult = parseJsonSafely(cleanedDetection, 'OpenAI text detection', true)
    
    console.log(`✅ Step 1 complete: Found ${detectionResult.textSegments?.length || 0} text segments`)

    // Step 2: Analyze each text segment linguistically
    console.log('📚 Step 2: Analyzing text linguistically...')
    const sentences = await Promise.all(
      (detectionResult.textSegments || []).map(async (segment: any, index: number) => {
        const LINGUISTIC_ANALYSIS_PROMPT = `
Analyze this Japanese sentence for language learning:

Text: "${segment.text}"

Provide a JSON response:
{
  "translation": "English translation",
  "words": [
    {
      "word": "Japanese word",
      "reading": "hiragana/katakana",
      "meaning": "English meaning",
      "partOfSpeech": "noun/verb/adjective/etc",
      "difficulty": "beginner/intermediate/advanced"
    }
  ],
  "grammar": [
    {
      "pattern": "Grammar pattern",
      "explanation": "Brief explanation",
      "example": "Example usage"
    }
  ],
  "context": "Brief context or usage notes"
}

IMPORTANT:
- Include only the 3-5 most important words
- Limit to 1-2 key grammar patterns
- Keep explanations concise
`

        try {
          const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.model,
              messages: [
                {
                  role: 'system',
                  content: 'You are a Japanese language learning assistant. Provide concise, accurate linguistic analysis in JSON format.'
                },
                {
                  role: 'user',
                  content: LINGUISTIC_ANALYSIS_PROMPT
                }
              ],
              temperature: 0.3,
              max_tokens: 800,
            }),
          })

          if (!analysisResponse.ok) {
            console.warn(`Analysis failed for segment ${index + 1}, using fallback`)
            return {
              sentence: segment.text,
              translation: 'Translation unavailable',
              words: [],
              grammar: [],
              context: 'Analysis failed',
              boundingBox: segment.boundingBox
            }
          }

          const analysisData = await analysisResponse.json()
          const analysisContent = analysisData.choices[0]?.message?.content
          const cleanedAnalysis = cleanJsonResponse(analysisContent)
          const linguisticResult = parseJsonSafely(cleanedAnalysis, `OpenAI linguistic analysis ${index + 1}`, true)

          return {
            sentence: segment.text,
            translation: linguisticResult.translation || '',
            words: linguisticResult.words || [],
            grammar: linguisticResult.grammar || [],
            context: linguisticResult.context || '',
            boundingBox: segment.boundingBox
          }
        } catch (error) {
          console.warn(`Error analyzing segment ${index + 1}:`, error)
          return {
            sentence: segment.text,
            translation: 'Translation unavailable',
            words: [],
            grammar: [],
            context: 'Analysis error',
            boundingBox: segment.boundingBox
          }
        }
      })
    )

    console.log(`✅ Step 2 complete: Analyzed ${sentences.length} sentences`)

    return {
      sentences,
      overallSummary: `Found and analyzed ${sentences.length} text segments in the manga image.`,
      provider: 'openai' as AIProvider
    }
  }
}

export class GeminiService {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor(apiKey: string, modelName?: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    const finalModelName = modelName || process.env.GEMINI_MODEL || 'gemini-pro-vision'
    console.log(`🔧 Gemini service initializing with model: ${finalModelName}`)
    this.model = this.genAI.getGenerativeModel({ model: finalModelName })
  }

  async analyzeText(text: string): Promise<AnalysisResult> {
    // Split text into sentences for batching
    const sentences = splitTextIntoSentences(text)
    console.log(`Gemini analyzeText: Split text into ${sentences.length} sentences`)
    
    // If we have few sentences, analyze all at once
    if (sentences.length <= 3) {
      return this.analyzeSingleBatch(text)
    }
    
    // Create batches for longer texts
    const batches = createTextBatches(sentences, 3) // 3 sentences per batch
    console.log(`Gemini analyzeText: Created ${batches.length} batches`)
    
    const batchResults: any[] = []
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchText = batch.join('')
      console.log(`Gemini analyzeText: Processing batch ${i + 1}/${batches.length} with ${batch.length} sentences`)
      
      try {
        const batchResult = await this.analyzeSingleBatch(batchText)
        batchResults.push(batchResult)
      } catch (error) {
        console.error(`Gemini analyzeText: Error processing batch ${i + 1}:`, error)
        // Continue with other batches rather than failing completely
      }
    }
    
    if (batchResults.length === 0) {
      throw new Error('All batches failed to process')
    }
    
    // Combine results from all batches
    const combinedResult = combineBatchResults(batchResults)
    console.log(`Gemini analyzeText: Combined ${batchResults.length} batch results into final result`)
    
    return {
      ...combinedResult,
      provider: 'gemini' as AIProvider
    }
  }

  private async analyzeSingleBatch(text: string): Promise<AnalysisResult> {
    const prompt = ANALYSIS_PROMPT(text)
    
    const result = await this.model.generateContent([
      {
        text: prompt
      }
    ])

    const response = await result.response
    const content = response.text()

    if (!content) {
      throw new Error('No content received from Gemini')
    }

    try {
      const cleanedContent = cleanJsonResponse(content)
      console.log('Gemini analyzeSingleBatch cleaned content preview:', cleanedContent.substring(0, 200) + '...')
      const analysisResult = parseJsonSafely(cleanedContent, 'Gemini analyzeSingleBatch')
      
      // Validate the structure of the analysis result
      const isValid = validateAnalysisResult(analysisResult, 'Gemini analyzeSingleBatch')
      if (!isValid) {
        throw new Error('Invalid analysis result structure')
      }
      
      return {
        ...analysisResult,
        provider: 'gemini' as AIProvider
      }
    } catch (error) {
      console.error('Gemini analyzeSingleBatch JSON parsing error:', error)
      console.error('Raw content:', content.substring(0, 500) + '...')
      throw new Error(`Failed to parse Gemini response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async analyzeImage(imageBase64: string): Promise<AnalysisResult> {
    const prompt = ANALYSIS_PROMPT()
    
    // Convert base64 to format Gemini expects
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: getImageMimeType(imageBase64)
      }
    }

    const result = await this.model.generateContent([
      prompt,
      imagePart
    ])

    const response = await result.response
    const content = response.text()

    if (!content) {
      throw new Error('No content received from Gemini')
    }

    try {
      const cleanedContent = cleanJsonResponse(content)
      console.log('Gemini analyzeImage cleaned content preview:', cleanedContent.substring(0, 200) + '...')
      const analysisResult = parseJsonSafely(cleanedContent, 'Gemini analyzeImage')
      
      // Validate the structure of the analysis result
      const isValid = validateAnalysisResult(analysisResult, 'Gemini analyzeImage')
      if (!isValid) {
        throw new Error('Invalid analysis result structure')
      }
      
      return {
        ...analysisResult,
        provider: 'gemini' as AIProvider
      }
    } catch (error) {
      console.error('Gemini analyzeImage JSON parsing error:', error)
      console.error('Raw content:', content.substring(0, 500) + '...')
      throw new Error(`Failed to parse Gemini response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async analyzeMangaImage(imageBase64: string): Promise<MangaAnalysisResult> {
    const prompt = MANGA_PANEL_ANALYSIS_PROMPT()
    
    // Convert base64 to format Gemini expects
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: getImageMimeType(imageBase64)
      }
    }

    const result = await this.model.generateContent([
      prompt,
      imagePart
    ])

    const response = await result.response
    const content = response.text()

    if (!content) {
      throw new Error('No content received from Gemini')
    }

    const analysisResult = parseJsonSafely(cleanJsonResponse(content), 'Gemini analyzeMangaImage', true)
    
    // Skip validation for simple analysis mode to be more lenient
    // const isValid = validateMangaAnalysisResult(analysisResult, 'Gemini analyzeMangaImage')
    // if (!isValid) {
    //   throw new Error('Invalid manga analysis result structure')
    // }
    
    // Ensure we have a proper readingOrder
    const readingOrder = analysisResult.readingOrder || (analysisResult.panels ? analysisResult.panels.map((_: any, index: number) => index + 1) : [])
    
    return {
      ...analysisResult,
      readingOrder,
      provider: 'gemini' as AIProvider
    }
  }

  async analyzeImageForReading(imageBase64: string): Promise<any> {
    console.log('📖 Gemini: Starting two-step reading mode analysis')
    
    // Step 1: Vision model to detect text and bounding boxes
    const TEXT_DETECTION_PROMPT = `
Analyze this manga image and identify ALL Japanese text with their precise locations.

For each text segment found, provide:
1. The exact Japanese text (character by character)
2. Precise bounding box coordinates (x, y, width, height) as percentages (0-100) of image dimensions

Provide a JSON response:
{
  "textSegments": [
    {
      "text": "Japanese text",
      "boundingBox": {
        "x": 10.5,
        "y": 20.3,
        "width": 25.7,
        "height": 8.2
      }
    }
  ]
}

IMPORTANT:
- Include ALL text: speech bubbles, sound effects, signs, narration
- Coordinates are percentages (0-100) relative to image dimensions
- Each distinct text area should be a separate segment
- Be precise with bounding boxes to cover the entire text area
`
    
    // Convert base64 to format Gemini expects
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: getImageMimeType(imageBase64)
      }
    }

    console.log('🔍 Step 1: Detecting text and locations...')
    const detectionResult = await this.model.generateContent([
      TEXT_DETECTION_PROMPT,
      imagePart
    ])

    const detectionResponse = await detectionResult.response
    const detectionContent = detectionResponse.text()

    if (!detectionContent) {
      throw new Error('No content received from Gemini detection')
    }

    const cleanedDetection = cleanJsonResponse(detectionContent)
    const parsedDetection = parseJsonSafely(cleanedDetection, 'Gemini text detection', true)
    
    console.log(`✅ Step 1 complete: Found ${parsedDetection.textSegments?.length || 0} text segments`)

    // Step 2: Analyze each text segment linguistically
    console.log('📚 Step 2: Analyzing text linguistically...')
    const sentences = await Promise.all(
      (parsedDetection.textSegments || []).map(async (segment: any, index: number) => {
        const LINGUISTIC_ANALYSIS_PROMPT = `
Analyze this Japanese sentence for language learning:

Text: "${segment.text}"

Provide a JSON response:
{
  "translation": "English translation",
  "words": [
    {
      "word": "Japanese word",
      "reading": "hiragana/katakana",
      "meaning": "English meaning",
      "partOfSpeech": "noun/verb/adjective/etc",
      "difficulty": "beginner/intermediate/advanced"
    }
  ],
  "grammar": [
    {
      "pattern": "Grammar pattern",
      "explanation": "Brief explanation",
      "example": "Example usage"
    }
  ],
  "context": "Brief context or usage notes"
}

IMPORTANT:
- Include only the 3-5 most important words
- Limit to 1-2 key grammar patterns
- Keep explanations concise
`

        try {
          const analysisResult = await this.model.generateContent([LINGUISTIC_ANALYSIS_PROMPT])
          const analysisResponse = await analysisResult.response
          const analysisContent = analysisResponse.text()
          const cleanedAnalysis = cleanJsonResponse(analysisContent)
          const linguisticResult = parseJsonSafely(cleanedAnalysis, `Gemini linguistic analysis ${index + 1}`, true)

          return {
            sentence: segment.text,
            translation: linguisticResult.translation || '',
            words: linguisticResult.words || [],
            grammar: linguisticResult.grammar || [],
            context: linguisticResult.context || '',
            boundingBox: segment.boundingBox
          }
        } catch (error) {
          console.warn(`Error analyzing segment ${index + 1}:`, error)
          return {
            sentence: segment.text,
            translation: 'Translation unavailable',
            words: [],
            grammar: [],
            context: 'Analysis error',
            boundingBox: segment.boundingBox
          }
        }
      })
    )

    console.log(`✅ Step 2 complete: Analyzed ${sentences.length} sentences`)

    return {
      sentences,
      overallSummary: `Found and analyzed ${sentences.length} text segments in the manga image.`,
      provider: 'gemini' as AIProvider
    }
  }
}

export class OpenAIFormatService {
  private settings: OpenAIFormatSettings

  constructor(settings: OpenAIFormatSettings) {
    this.settings = settings
  }

  async analyzeText(text: string): Promise<AnalysisResult> {
    // Split text into sentences for batching
    const sentences = splitTextIntoSentences(text)
    console.log(`OpenAI-format analyzeText: Split text into ${sentences.length} sentences`)
    
    // If we have few sentences, analyze all at once
    if (sentences.length <= 2) { // Use smaller batch size for OpenAI-format due to stricter limits
      return this.analyzeSingleBatch(text)
    }
    
    // Create batches for longer texts
    const batches = createTextBatches(sentences, 2) // 2 sentences per batch for OpenAI-format
    console.log(`OpenAI-format analyzeText: Created ${batches.length} batches`)
    
    const batchResults: any[] = []
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchText = batch.join('')
      console.log(`OpenAI-format analyzeText: Processing batch ${i + 1}/${batches.length} with ${batch.length} sentences`)
      
      try {
        const batchResult = await this.analyzeSingleBatch(batchText)
        batchResults.push(batchResult)
      } catch (error) {
        console.error(`OpenAI-format analyzeText: Error processing batch ${i + 1}:`, error)
        // Continue with other batches rather than failing completely
      }
    }
    
    if (batchResults.length === 0) {
      throw new Error('All batches failed to process')
    }
    
    // Combine results from all batches
    const combinedResult = combineBatchResults(batchResults)
    console.log(`OpenAI-format analyzeText: Combined ${batchResults.length} batch results into final result`)
    
    return {
      ...combinedResult,
      provider: 'openai-format' as AIProvider
    }
  }

  private async analyzeSingleBatch(text: string): Promise<AnalysisResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (this.settings.apiKey) {
      headers['Authorization'] = `Bearer ${this.settings.apiKey}`
    }

    const response = await fetch(`${this.settings.endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.settings.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful Japanese language learning assistant that provides detailed analysis of Japanese text for learners. Always respond with valid JSON. Keep responses concise to avoid truncation.'
          },
          {
            role: 'user',
            content: CONCISE_ANALYSIS_PROMPT(text)
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`OpenAI-format API error: ${response.status}`, { 
        endpoint: `${this.settings.endpoint}/chat/completions`,
        model: this.settings.model,
        hasApiKey: !!this.settings.apiKey,
        error: errorText 
      })
      throw new Error(`OpenAI-format API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI-format API')
    }

    try {
      const cleanedContent = cleanJsonResponse(content)
      console.log('OpenAI-format analyzeSingleBatch cleaned content preview:', cleanedContent.substring(0, 200) + '...')
      const analysisResult = parseJsonSafely(cleanedContent, 'OpenAI-format analyzeSingleBatch')
      
      // Validate the structure of the analysis result
      const isValid = validateAnalysisResult(analysisResult, 'OpenAI-format analyzeSingleBatch')
      if (!isValid) {
        throw new Error('Invalid analysis result structure')
      }
      
      return {
        ...analysisResult,
        provider: 'openai-format' as AIProvider
      }
    } catch (error) {
      console.error('OpenAI-format analyzeSingleBatch JSON parsing error:', error)
      console.error('Raw content:', content.substring(0, 500) + '...')
      throw new Error(`Failed to parse OpenAI-format response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async analyzeImage(imageBase64: string): Promise<AnalysisResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (this.settings.apiKey) {
      headers['Authorization'] = `Bearer ${this.settings.apiKey}`
    }

    const response = await fetch(`${this.settings.endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.settings.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful Japanese language learning assistant that can read Japanese text from manga images and provide detailed analysis for learners. Always respond with valid JSON. Keep responses concise to avoid truncation.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: CONCISE_ANALYSIS_PROMPT()
              },
              {
                type: 'image_url',
                image_url: {
                  url: createImageDataURL(imageBase64)
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`OpenAI-format API error: ${response.status}`, { 
        endpoint: `${this.settings.endpoint}/chat/completions`,
        model: this.settings.model,
        hasApiKey: !!this.settings.apiKey,
        error: errorText 
      })
      throw new Error(`OpenAI-format API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI-format API')
    }

    try {
      const cleanedContent = cleanJsonResponse(content)
      console.log('OpenAI-format analyzeImage cleaned content preview:', cleanedContent.substring(0, 200) + '...')
      const analysisResult = parseJsonSafely(cleanedContent, 'OpenAI-format analyzeImage')
      
      // Validate the structure of the analysis result
      const isValid = validateAnalysisResult(analysisResult, 'OpenAI-format analyzeImage')
      if (!isValid) {
        throw new Error('Invalid analysis result structure')
      }
      
      return {
        ...analysisResult,
        provider: 'openai-format' as AIProvider
      }
    } catch (error) {
      console.error('OpenAI-format analyzeImage final error:', error)
      console.error('Raw content:', content.substring(0, 1000) + '...')
      throw error
    }
  }

  async analyzeMangaImage(imageBase64: string): Promise<MangaAnalysisResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (this.settings.apiKey) {
      headers['Authorization'] = `Bearer ${this.settings.apiKey}`
    }

    const response = await fetch(`${this.settings.endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.settings.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful Japanese language learning assistant specialized in manga analysis. You can identify manga panels and extract text from each panel separately following traditional right-to-left, top-to-bottom reading order. Always respond with valid JSON. Keep responses concise to avoid truncation.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: CONCISE_MANGA_PANEL_ANALYSIS_PROMPT()
              },
              {
                type: 'image_url',
                image_url: {
                  url: createImageDataURL(imageBase64)
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`OpenAI-format API error: ${response.status}`, { 
        endpoint: `${this.settings.endpoint}/chat/completions`,
        model: this.settings.model,
        hasApiKey: !!this.settings.apiKey,
        error: errorText 
      })
      throw new Error(`OpenAI-format API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI-format API')
    }

    try {
      const cleanedContent = cleanJsonResponse(content)
      console.log('OpenAI-format analyzeMangaImage cleaned content preview:', cleanedContent.substring(0, 200) + '...')
      const analysisResult = parseJsonSafely(cleanedContent, 'OpenAI-format analyzeMangaImage', true)
      
      // Skip validation for simple analysis mode to be more lenient
      // const isValid = validateMangaAnalysisResult(analysisResult, 'OpenAI-format analyzeMangaImage')
      // if (!isValid) {
      //   throw new Error('Invalid manga analysis result structure')
      // }
      
      // Ensure we have a proper readingOrder
      const readingOrder = analysisResult.readingOrder || (analysisResult.panels ? analysisResult.panels.map((_: any, index: number) => index + 1) : [])
      
      return {
        ...analysisResult,
        readingOrder,
        provider: 'openai-format' as AIProvider
      }
    } catch (error) {
      console.error('OpenAI-format analyzeMangaImage JSON parsing error:', error)
      console.error('Raw content:', content.substring(0, 500) + '...')
      throw new Error(`Failed to parse OpenAI-format response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async analyzeImageForReading(imageBase64: string): Promise<any> {
    console.log('📖 OpenAI-format: Starting two-step reading mode analysis')
    console.log('🔧 Endpoint:', `${this.settings.endpoint}/chat/completions`)
    console.log('🤖 Model:', this.settings.model)
    console.log('🔑 Has API Key:', !!this.settings.apiKey)
    
    // Check if image is too large and compress if needed
    const imageSizeKB = Math.round(imageBase64.length * 3 / 4 / 1024)
    console.log(`📏 Image size: ${imageSizeKB} KB`)
    
    let processedImageBase64 = imageBase64
    if (imageSizeKB > 500) {
      console.log('⚠️ Image is large, attempting compression for faster processing...')
      try {
        processedImageBase64 = await compressImageForAPI(imageBase64, 500)
        const compressedSizeKB = Math.round(processedImageBase64.length * 3 / 4 / 1024)
        console.log(`✅ Image compressed to ${compressedSizeKB} KB`)
      } catch (compressionError) {
        console.warn('⚠️ Image compression failed, using original image:', compressionError)
      }
    }
    
    return this.performTwoStepReadingAnalysis(processedImageBase64)
  }
  
  private async performTwoStepReadingAnalysis(imageBase64: string): Promise<any> {
    // Step 1: Vision model to detect text and bounding boxes
    const TEXT_DETECTION_PROMPT = `
Analyze this manga image and identify ALL Japanese text with their precise locations.

For each text segment found, provide:
1. The exact Japanese text (character by character)
2. Precise bounding box coordinates (x, y, width, height) as percentages (0-100) of image dimensions

Provide a JSON response:
{
  "textSegments": [
    {
      "text": "Japanese text",
      "boundingBox": {
        "x": 10.5,
        "y": 20.3,
        "width": 25.7,
        "height": 8.2
      }
    }
  ]
}

IMPORTANT:
- Include ALL text: speech bubbles, sound effects, signs, narration
- Coordinates are percentages (0-100) relative to image dimensions
- Each distinct text area should be a separate segment
- Be precise with bounding boxes to cover the entire text area
`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (this.settings.apiKey) {
      headers['Authorization'] = `Bearer ${this.settings.apiKey}`
    }

    console.log('🔍 Step 1: Detecting text and locations...')
    const detectionResponse = await fetch(`${this.settings.endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.settings.model,
        messages: [
          {
            role: 'system',
            content: 'You are a vision model specialized in detecting Japanese text and precise locations in manga images. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: TEXT_DETECTION_PROMPT
              },
              {
                type: 'image_url',
                image_url: {
                  url: createImageDataURL(imageBase64)
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    })

    if (!detectionResponse.ok) {
      const errorText = await detectionResponse.text()
      throw new Error(`OpenAI-format API error (detection): ${detectionResponse.status} - ${errorText}`)
    }

    const detectionData = await detectionResponse.json()
    const detectionContent = detectionData.choices[0]?.message?.content

    if (!detectionContent) {
      throw new Error('No content received from detection')
    }

    const cleanedDetection = cleanJsonResponse(detectionContent)
    const detectionResult = parseJsonSafely(cleanedDetection, 'OpenAI-format text detection', true)
    
    console.log(`✅ Step 1 complete: Found ${detectionResult.textSegments?.length || 0} text segments`)

    // Step 2: Analyze each text segment linguistically
    console.log('📚 Step 2: Analyzing text linguistically...')
    const sentences = await Promise.all(
      (detectionResult.textSegments || []).map(async (segment: any, index: number) => {
        const LINGUISTIC_ANALYSIS_PROMPT = `
Analyze this Japanese sentence for language learning:

Text: "${segment.text}"

Provide a JSON response:
{
  "translation": "English translation",
  "words": [
    {
      "word": "Japanese word",
      "reading": "hiragana/katakana",
      "meaning": "English meaning",
      "partOfSpeech": "noun/verb/adjective/etc",
      "difficulty": "beginner/intermediate/advanced"
    }
  ],
  "grammar": [
    {
      "pattern": "Grammar pattern",
      "explanation": "Brief explanation",
      "example": "Example usage"
    }
  ],
  "context": "Brief context or usage notes"
}

IMPORTANT:
- Include only the 3-5 most important words
- Limit to 1-2 key grammar patterns
- Keep explanations concise
`

        try {
          const analysisResponse = await fetch(`${this.settings.endpoint}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: this.settings.model,
              messages: [
                {
                  role: 'system',
                  content: 'You are a Japanese language learning assistant. Provide concise, accurate linguistic analysis in JSON format.'
                },
                {
                  role: 'user',
                  content: LINGUISTIC_ANALYSIS_PROMPT
                }
              ],
              temperature: 0.3,
              max_tokens: 800,
            }),
          })

          if (!analysisResponse.ok) {
            console.warn(`Analysis failed for segment ${index + 1}, using fallback`)
            return {
              sentence: segment.text,
              translation: 'Translation unavailable',
              words: [],
              grammar: [],
              context: 'Analysis failed',
              boundingBox: segment.boundingBox
            }
          }

          const analysisData = await analysisResponse.json()
          const analysisContent = analysisData.choices[0]?.message?.content
          const cleanedAnalysis = cleanJsonResponse(analysisContent)
          const linguisticResult = parseJsonSafely(cleanedAnalysis, `OpenAI-format linguistic analysis ${index + 1}`, true)

          return {
            sentence: segment.text,
            translation: linguisticResult.translation || '',
            words: linguisticResult.words || [],
            grammar: linguisticResult.grammar || [],
            context: linguisticResult.context || '',
            boundingBox: segment.boundingBox
          }
        } catch (error) {
          console.warn(`Error analyzing segment ${index + 1}:`, error)
          return {
            sentence: segment.text,
            translation: 'Translation unavailable',
            words: [],
            grammar: [],
            context: 'Analysis error',
            boundingBox: segment.boundingBox
          }
        }
      })
    )

    console.log(`✅ Step 2 complete: Analyzed ${sentences.length} sentences`)

    return {
      sentences,
      overallSummary: `Found and analyzed ${sentences.length} text segments in the manga image.`,
      provider: 'openai-format' as AIProvider
    }
  }
  
  
}

export class AIAnalysisService {
  private openaiService?: OpenAIService
  private geminiService?: GeminiService
  private openaiFormatService?: OpenAIFormatService
  private panelSegmentationService: ClientPanelSegmentationService
  private improvedTextDetection: ImprovedTextDetectionService

  constructor(
    openaiApiKey?: string, 
    geminiApiKey?: string, 
    openaiFormatSettings?: OpenAIFormatSettings,
    modelSettings?: ModelSettings
  ) {
    // Initialize client-side panel segmentation service
    this.panelSegmentationService = new ClientPanelSegmentationService()
    this.improvedTextDetection = new ImprovedTextDetectionService({
      enableRetry: true,
      maxRetries: 2,
      useOCRPreprocessing: true
    })
    
    // Only initialize OpenAI service if both API key and model are available
    if (openaiApiKey) {
      const openaiModel = modelSettings?.openai?.model?.trim()
      if (openaiModel) {
        this.openaiService = new OpenAIService(openaiApiKey, openaiModel)
      } else {
        // Check if environment variable has a model as fallback
        const envModel = process.env.OPENAI_MODEL?.trim()
        if (envModel) {
          this.openaiService = new OpenAIService(openaiApiKey, envModel)
        }
        // If no model available, don't initialize the service
      }
    }
    
    // Only initialize Gemini service if both API key and model are available
    if (geminiApiKey) {
      const geminiModel = modelSettings?.gemini?.model?.trim()
      console.log(`🔧 Gemini initialization - modelSettings.gemini.model: "${geminiModel}"`)
      if (geminiModel) {
        console.log(`🔧 Using provided model: ${geminiModel}`)
        this.geminiService = new GeminiService(geminiApiKey, geminiModel)
      } else {
        // Check if environment variable has a model as fallback
        const envModel = process.env.GEMINI_MODEL?.trim()
        console.log(`🔧 Using environment model: ${envModel}`)
        if (envModel) {
          this.geminiService = new GeminiService(geminiApiKey, envModel)
        }
        // If no model available, don't initialize the service
      }
    }
    
    // Only initialize OpenAI-format service if endpoint and model are provided
    if (openaiFormatSettings?.endpoint?.trim() && openaiFormatSettings?.model?.trim()) {
      this.openaiFormatService = new OpenAIFormatService(openaiFormatSettings)
    }
  }

  async analyzeText(text: string, provider: AIProvider = 'openai'): Promise<AnalysisResult> {
    if (provider === 'openai' && this.openaiService) {
      return await this.openaiService.analyzeText(text)
    } else if (provider === 'gemini' && this.geminiService) {
      return await this.geminiService.analyzeText(text)
    } else if (provider === 'openai-format' && this.openaiFormatService) {
      return await this.openaiFormatService.analyzeText(text)
    } else {
      throw new Error(`${provider} service not available or not configured`)
    }
  }

  async analyzeImage(imageBase64: string, provider: AIProvider = 'openai'): Promise<AnalysisResult> {
    if (provider === 'openai' && this.openaiService) {
      return await this.openaiService.analyzeImage(imageBase64)
    } else if (provider === 'gemini' && this.geminiService) {
      return await this.geminiService.analyzeImage(imageBase64)
    } else if (provider === 'openai-format' && this.openaiFormatService) {
      return await this.openaiFormatService.analyzeImage(imageBase64)
    } else {
      throw new Error(`${provider} service not available or not configured`)
    }
  }

  async analyzeMangaImage(imageBase64: string, provider: AIProvider = 'openai'): Promise<MangaAnalysisResult> {
    try {
      console.log('🔍 Starting client-side panel segmentation...')
      
      // Check if client-side segmentation is available
      if (!this.panelSegmentationService.isAvailable()) {
        console.log('⚠️ Client-side segmentation not available, falling back to direct analysis')
        return await this.analyzeMangaImageDirect(imageBase64, provider)
      }
      
      // Initialize the client-side segmentation service
      await this.panelSegmentationService.initialize()
      
      // Segment the panels using client-side OpenCV.js
      const segmentationResult = await this.panelSegmentationService.segmentPanels(imageBase64)
      
      console.log('📊 Segmentation result:', {
        panelCount: segmentationResult.panels.length,
        readingOrder: segmentationResult.readingOrder,
        hasImageData: segmentationResult.panels.map(p => !!p.imageData)
      })
      
      if (segmentationResult.panels.length === 0) {
        console.log('⚠️ No panels found, falling back to direct analysis')
        // Fallback to original analysis if segmentation fails
        return await this.analyzeMangaImageDirect(imageBase64, provider)
      }

      // Analyze each panel individually using improved text detection
      const panelAnalyses = await Promise.allSettled(
        segmentationResult.panels.map(async (segmentedPanel: SegmentedPanel, index: number) => {
          try {
            // Use reading order position as panel number (1-based)
            const readingOrderPosition = segmentationResult.readingOrder[index]
            console.log(`🔍 Analyzing panel ${readingOrderPosition} (position ${index + 1}) with improved text detection...`)
            
            // Use improved text detection service
            const panelAnalysis = await this.improvedTextDetection.analyzePanel(
              segmentedPanel.imageData,
              this,
              provider,
              readingOrderPosition
            )
            
            // Set the position from segmentation result
            panelAnalysis.position = segmentedPanel.boundingBox
            
            return panelAnalysis
          } catch (error) {
            console.error(`❌ Error analyzing panel ${segmentationResult.readingOrder[index]}:`, error)
            return {
              panelNumber: segmentationResult.readingOrder[index],
              position: segmentedPanel.boundingBox,
              imageData: segmentedPanel.imageData,
              extractedText: '',
              sentences: [],
              translation: 'Analysis failed for this panel',
              words: [],
              grammar: [],
              context: 'Unable to analyze this panel'
            } as MangaPanel
          }
        })
      )

      // Extract successful analyses
      const panels: MangaPanel[] = panelAnalyses
        .filter((result): result is PromiseFulfilledResult<MangaPanel> => result.status === 'fulfilled')
        .map(result => result.value)

      console.log('✅ Panel analysis complete:', {
        totalPanels: panels.length,
        panelsWithImages: panels.filter(p => p.imageData).length,
        panelsWithText: panels.filter(p => p.extractedText).length
      })

      // Generate overall summary based on panel analyses
      const allText = panels.map(p => p.extractedText).filter(text => text.length > 0).join(' ')
      const allTranslations = panels.map(p => p.translation).filter(t => t.length > 0).join(' ')
      
      let overallSummary = 'This manga page contains ' + panels.length + ' panels.'
      if (allText.length > 0) {
        overallSummary += ` The story progresses through dialogue and scenes showing: ${allTranslations.substring(0, 200)}${allTranslations.length > 200 ? '...' : ''}`
      }

      return {
        panels,
        overallSummary,
        readingOrder: segmentationResult.readingOrder,
        provider
      }

    } catch (error) {
      console.error('❌ Panel segmentation failed, falling back to direct analysis:', error)
      // Fallback to original analysis method
      return await this.analyzeMangaImageDirect(imageBase64, provider)
    }
  }

  async analyzeMangaImageDirect(imageBase64: string, provider: AIProvider = 'openai'): Promise<MangaAnalysisResult> {
    console.log('📁 Using direct analysis fallback')
    
    let result: MangaAnalysisResult
    if (provider === 'openai' && this.openaiService) {
      result = await this.openaiService.analyzeMangaImage(imageBase64)
    } else if (provider === 'gemini' && this.geminiService) {
      result = await this.geminiService.analyzeMangaImage(imageBase64)
    } else if (provider === 'openai-format' && this.openaiFormatService) {
      result = await this.openaiFormatService.analyzeMangaImage(imageBase64)
    } else {
      throw new Error(`${provider} service not available or not configured`)
    }

    // Add the original image data to panels for display purposes
    const enhancedPanels = result.panels.map(panel => ({
      ...panel,
      imageData: imageBase64 // Use the original image as a fallback
    }))

    // Ensure we have a proper readingOrder
    const readingOrder = result.readingOrder || enhancedPanels.map((_, index) => index + 1)

    return {
      ...result,
      panels: enhancedPanels,
      readingOrder
    }
  }

  async analyzeImageForReading(imageBase64: string, provider: AIProvider = 'openai'): Promise<ReadingModeResult> {
    console.log('📖 Starting reading mode analysis with provider:', provider)
    
    try {
      let result: any
      if (provider === 'openai' && this.openaiService) {
        result = await this.openaiService.analyzeImageForReading(imageBase64)
      } else if (provider === 'gemini' && this.geminiService) {
        result = await this.geminiService.analyzeImageForReading(imageBase64)
      } else if (provider === 'openai-format' && this.openaiFormatService) {
        result = await this.openaiFormatService.analyzeImageForReading(imageBase64)
      } else {
        throw new Error(`${provider} service not available or not configured`)
      }

      const sentences = Array.isArray(result.sentences)
        ? result.sentences.map((sentence: any) => {
            const normalizedBoundingBox = normalizeBoundingBox(sentence?.boundingBox)
            return {
              ...sentence,
              words: Array.isArray(sentence?.words) ? sentence.words : [],
              grammar: Array.isArray(sentence?.grammar) ? sentence.grammar : [],
              boundingBox: normalizedBoundingBox ?? sentence?.boundingBox ?? null
            }
          })
        : []

      const imageDataUrl = createImageDataURL(imageBase64)

      return {
        sentences,
        imageData: imageDataUrl,
        overallSummary: result.overallSummary || result.summary || 'Reading mode analysis completed',
        provider
      }
    } catch (error) {
      console.error('❌ Reading mode analysis failed:', error)
      throw error
    }
  }

  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = []
    if (this.openaiService) providers.push('openai')
    if (this.geminiService) providers.push('gemini')
    if (this.openaiFormatService) providers.push('openai-format')
    return providers
  }
}
