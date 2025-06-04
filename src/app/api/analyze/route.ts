import { NextRequest, NextResponse } from 'next/server'
import { AIAnalysisService, type AnalysisResult } from '@/lib/ai-service'
import { type AIProvider, type OpenAIFormatSettings, type ModelSettings, type APIKeySettings, type MangaAnalysisResult } from '@/lib/types'

interface AnalysisRequest {
  text?: string
  imageBase64?: string
  provider?: AIProvider
  openaiFormatSettings?: OpenAIFormatSettings
  modelSettings?: ModelSettings
  apiKeySettings?: APIKeySettings
  mangaMode?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const { text, imageBase64, provider = 'openai', openaiFormatSettings, modelSettings, apiKeySettings, mangaMode = false }: AnalysisRequest = await request.json()

    if (!text && !imageBase64) {
      return NextResponse.json(
        { error: 'Either text or image is required for analysis' },
        { status: 400 }
      )
    }

    // Use API keys from request if provided, otherwise fall back to environment variables
    const openaiApiKey = apiKeySettings?.openai || process.env.OPENAI_API_KEY
    const geminiApiKey = apiKeySettings?.gemini || process.env.GEMINI_API_KEY

    // For OpenAI-format, use settings from request or fall back to environment variables
    let finalOpenAIFormatSettings: OpenAIFormatSettings | undefined
    if (openaiFormatSettings?.endpoint?.trim() && openaiFormatSettings?.model?.trim()) {
      finalOpenAIFormatSettings = openaiFormatSettings
    } else if (process.env.OPENAI_FORMAT_API_URL && process.env.OPENAI_FORMAT_MODEL) {
      finalOpenAIFormatSettings = {
        endpoint: process.env.OPENAI_FORMAT_API_URL,
        model: process.env.OPENAI_FORMAT_MODEL,
        apiKey: process.env.OPENAI_FORMAT_API_KEY // Optional
      }
    }

    const hasOpenAIFormat = !!finalOpenAIFormatSettings

    if (!openaiApiKey && !geminiApiKey && !hasOpenAIFormat) {
      return NextResponse.json(
        { 
          error: 'No AI service configured. Please:\n• Set OpenAI API key and select "OpenAI" provider, or\n• Set Gemini API key and select "Gemini" provider, or\n• Configure OpenAI-Compatible API with valid endpoint and model' 
        },
        { status: 500 }
      )
    }

    const aiService = new AIAnalysisService(
      openaiApiKey, 
      geminiApiKey, 
      finalOpenAIFormatSettings,
      modelSettings
    )
    const availableProviders = aiService.getAvailableProviders()

    if (!availableProviders.includes(provider)) {
      // Fallback to available provider
      const fallbackProvider = availableProviders[0]
      if (!fallbackProvider) {
        return NextResponse.json(
          { error: 'No AI providers available. Please check your API keys or OpenAI-format settings.' },
          { status: 500 }
        )
      }
      
      let result: AnalysisResult | MangaAnalysisResult
      if (imageBase64) {
        if (mangaMode) {
          result = await aiService.analyzeMangaImage(imageBase64, fallbackProvider)
        } else {
          result = await aiService.analyzeImage(imageBase64, fallbackProvider)
        }
      } else {
        result = await aiService.analyzeText(text!, fallbackProvider)
      }
      return NextResponse.json(result)
    }

    let result: AnalysisResult | MangaAnalysisResult
    if (imageBase64) {
      if (mangaMode) {
        result = await aiService.analyzeMangaImage(imageBase64, provider)
      } else {
        result = await aiService.analyzeImage(imageBase64, provider)
      }
    } else {
      result = await aiService.analyzeText(text!, provider)
    }
    return NextResponse.json(result)

  } catch (error) {
    console.error('Analysis error:', error)
    
    // Extract mangaMode from the request for error handling
    let mangaMode = false
    try {
      const requestBody = await request.clone().json()
      mangaMode = requestBody.mangaMode || false
    } catch {
      // If we can't parse the request, default to false
    }
    
    // Return fallback response if analysis fails
    if (mangaMode) {
      return NextResponse.json({
        panels: [],
        overallSummary: "Unable to analyze manga panels at this time.",
        readingOrder: [],
        provider: 'fallback' as AIProvider,
        error: error instanceof Error ? error.message : 'Failed to analyze manga'
      }, { status: 500 })
    } else {
      return NextResponse.json({
        extractedText: "Unable to extract text from image",
        translation: "Translation analysis failed. Please try again.",
        summary: "Unable to analyze the context at this time.",
        words: [],
        grammar: [],
        provider: 'fallback' as AIProvider,
        error: error instanceof Error ? error.message : 'Failed to analyze text'
      }, { status: 500 })
    }
  }
}
