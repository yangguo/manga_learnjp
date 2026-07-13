import { NextRequest, NextResponse } from 'next/server'
import { AIAnalysisService } from '@/lib/ai-service'
import { runWithTransientAnalysisRetry } from '@/lib/transient-analysis'
import { type AIProvider, type AnalysisLanguage, type AnalysisResult, type OpenAIFormatSettings, type MangaAnalysisResult, type ReadingModeResult } from '@/lib/types'

interface AnalysisRequest {
  text?: string
  imageBase64?: string
  provider?: AIProvider
  mangaMode?: boolean
  simpleAnalysisMode?: boolean
  readingMode?: boolean
  analysisLanguage?: AnalysisLanguage
  excludeN5?: boolean
}

export const maxDuration = 300 // 5 minutes for reading mode analysis

export async function POST(request: NextRequest) {
  try {
    const { text, imageBase64, provider = 'openai', mangaMode = false, simpleAnalysisMode = false, readingMode = false, analysisLanguage = 'en', excludeN5 = false }: AnalysisRequest = await request.json()

    if (!text && !imageBase64) {
      return NextResponse.json(
        { error: 'Either text or image is required for analysis' },
        { status: 400 }
      )
    }

    // All credentials come exclusively from environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY

    let openaiFormatSettings: OpenAIFormatSettings | undefined
    if (process.env.OPENAI_FORMAT_API_URL && process.env.OPENAI_FORMAT_MODEL) {
      openaiFormatSettings = {
        endpoint: process.env.OPENAI_FORMAT_API_URL,
        model: process.env.OPENAI_FORMAT_MODEL,
        apiKey: process.env.OPENAI_FORMAT_API_KEY
      }
    }

    if (!openaiApiKey && !openaiFormatSettings) {
      return NextResponse.json(
        { error: 'No AI service configured. Set OPENAI_API_KEY or OPENAI_FORMAT_* environment variables.' },
        { status: 500 }
      )
    }

    const aiService = new AIAnalysisService(openaiApiKey, openaiFormatSettings)
    const availableProviders = aiService.getAvailableProviders()

    if (availableProviders.length === 0) {
      return NextResponse.json(
        { error: 'No AI providers available. Please check your environment variables.' },
        { status: 500 }
      )
    }

    // Try requested provider first, then fall back to other available providers
    const providersToTry = availableProviders.includes(provider)
      ? [provider, ...availableProviders.filter(p => p !== provider)]
      : availableProviders

    let lastError: Error | null = null
    
    for (const currentProvider of providersToTry) {
      try {
        console.log(`🔄 Trying provider: ${currentProvider}`)

        const result = await runWithTransientAnalysisRetry<AnalysisResult | MangaAnalysisResult | ReadingModeResult>(
          async () => {
            if (imageBase64) {
              const imageSizeKB = Math.round(imageBase64.length * 3 / 4 / 1024)
              console.log(`📏 Image size: ${imageSizeKB} KB`)

              if (readingMode) {
                return await aiService.analyzeImageForReading(imageBase64, currentProvider, analysisLanguage)
              } else if (mangaMode) {
                return await aiService.analyzeMangaImage(imageBase64, currentProvider)
              } else if (simpleAnalysisMode) {
                return await aiService.analyzeMangaImageDirect(imageBase64, currentProvider)
              } else {
                return await aiService.analyzeImage(imageBase64, currentProvider, analysisLanguage, excludeN5)
              }
            } else {
              return await aiService.analyzeText(text!, currentProvider, analysisLanguage, excludeN5)
            }
          },
          {
            onRetry: (retryError, nextAttempt) => {
              console.warn(
                `Transient analysis error from provider ${currentProvider}; retrying attempt ${nextAttempt}:`,
                retryError instanceof Error ? retryError.message : 'Unknown error'
              )
            }
          }
        )
        
        console.log(`✅ Success with provider: ${currentProvider}`)
        return NextResponse.json(result)
        
      } catch (error) {
        console.log(`❌ Provider ${currentProvider} failed:`, error instanceof Error ? error.message : 'Unknown error')
        lastError = error instanceof Error ? error : new Error('Unknown error')
        continue
      }
    }

    throw lastError || new Error('All providers failed')

  } catch (error) {
    console.error('Analysis error:', error)
    
    let mangaMode = false
    let readingMode = false
    try {
      const requestBody = await request.clone().json()
      mangaMode = requestBody.mangaMode || false
      readingMode = requestBody.readingMode || false
    } catch {
      // ignore parse errors
    }
    
    if (readingMode) {
      return NextResponse.json({
        sentences: [],
        imageData: null,
        overallSummary: 'Reading mode analysis failed. Please try with a smaller image or use regular analysis mode.',
        provider: 'fallback' as AIProvider,
        error: error instanceof Error ? error.message : 'Failed to analyze reading mode'
      }, { status: 500 })
    } else if (mangaMode) {
      return NextResponse.json({
        panels: [],
        overallSummary: 'Unable to analyze manga panels at this time.',
        readingOrder: [],
        provider: 'fallback' as AIProvider,
        error: error instanceof Error ? error.message : 'Failed to analyze manga'
      }, { status: 500 })
    } else {
      return NextResponse.json({
        extractedText: 'Unable to extract text from image',
        translation: 'Translation analysis failed. Please try again.',
        summary: 'Unable to analyze the context at this time.',
        words: [],
        grammar: [],
        provider: 'fallback' as AIProvider,
        error: error instanceof Error ? error.message : 'Failed to analyze text'
      }, { status: 500 })
    }
  }
}
