import { NextResponse } from 'next/server'
import { AIAnalysisService } from '@/lib/ai-service'
import { type OpenAIFormatSettings } from '@/lib/types'

export async function GET() {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY

    // Check for OpenAI-format configuration in environment variables
    let openaiFormatSettings: OpenAIFormatSettings | undefined
    if (process.env.OPENAI_FORMAT_API_URL && process.env.OPENAI_FORMAT_MODEL) {
      openaiFormatSettings = {
        endpoint: process.env.OPENAI_FORMAT_API_URL,
        model: process.env.OPENAI_FORMAT_MODEL,
        apiKey: process.env.OPENAI_FORMAT_API_KEY // Optional
      }
    }

    const aiService = new AIAnalysisService(openaiApiKey, geminiApiKey, openaiFormatSettings)
    const availableProviders = aiService.getAvailableProviders()
    
    // OpenAI-format is always available as it can be configured in the UI
    if (!availableProviders.includes('openai-format')) {
      availableProviders.push('openai-format')
    }

    // Smart default selection: prefer the first actually available provider
    // Priority order: openai -> gemini -> openai-format
    let smartDefault: string = 'openai-format' // fallback if nothing else is available
    
    if (availableProviders.includes('openai')) {
      smartDefault = 'openai'
    } else if (availableProviders.includes('gemini')) {
      smartDefault = 'gemini'
    }

    return NextResponse.json({
      providers: availableProviders,
      default: smartDefault
    })
  } catch (error) {
    console.error('Error checking providers:', error)
    return NextResponse.json(
      { error: 'Failed to check available providers' },
      { status: 500 }
    )
  }
}
