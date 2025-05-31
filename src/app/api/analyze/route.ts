import { NextRequest, NextResponse } from 'next/server'
import { AIAnalysisService, type AnalysisResult } from '@/lib/ai-service'
import { type AIProvider, type OpenAIFormatSettings } from '@/lib/types'

interface AnalysisRequest {
  text?: string
  imageBase64?: string
  provider?: AIProvider
  openaiFormatSettings?: OpenAIFormatSettings
}

export async function POST(request: NextRequest) {
  try {
    const { text, imageBase64, provider = 'openai', openaiFormatSettings }: AnalysisRequest = await request.json()

    if (!text && !imageBase64) {
      return NextResponse.json(
        { error: 'Either text or image is required for analysis' },
        { status: 400 }
      )
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY

    // For OpenAI-format, we need settings but API key is optional
    let hasOpenAIFormat = false
    if (provider === 'openai-format' && openaiFormatSettings?.endpoint && openaiFormatSettings?.model) {
      hasOpenAIFormat = true
    }

    if (!openaiApiKey && !geminiApiKey && !hasOpenAIFormat) {
      return NextResponse.json(
        { error: 'No AI service configured. Please set up OpenAI, Gemini API keys, or OpenAI-format settings.' },
        { status: 500 }
      )
    }

    const aiService = new AIAnalysisService(
      openaiApiKey, 
      geminiApiKey, 
      hasOpenAIFormat ? openaiFormatSettings : undefined
    )
    const availableProviders = aiService.getAvailableProviders()

    if (!availableProviders.includes(provider)) {
      // Fallback to available provider
      const fallbackProvider = availableProviders[0]
      if (!fallbackProvider) {
        return NextResponse.json(
          { error: 'No AI providers available' },
          { status: 500 }
        )
      }
      
      console.log(`Provider ${provider} not available, using ${fallbackProvider}`)
      
      let result: AnalysisResult
      if (imageBase64) {
        result = await aiService.analyzeImage(imageBase64, fallbackProvider)
      } else {
        result = await aiService.analyzeText(text!, fallbackProvider)
      }
      return NextResponse.json(result)
    }

    let result: AnalysisResult
    if (imageBase64) {
      result = await aiService.analyzeImage(imageBase64, provider)
    } else {
      result = await aiService.analyzeText(text!, provider)
    }
    return NextResponse.json(result)

  } catch (error) {
    console.error('Analysis error:', error)
    
    // Return fallback response if analysis fails
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
