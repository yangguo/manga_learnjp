import { NextResponse } from 'next/server'
import { AIAnalysisService } from '@/lib/ai-service'

export async function GET() {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY

    const aiService = new AIAnalysisService(openaiApiKey, geminiApiKey)
    const availableProviders = aiService.getAvailableProviders()
    
    // OpenAI-format is always available as it can be configured in the UI
    if (!availableProviders.includes('openai-format')) {
      availableProviders.push('openai-format')
    }

    return NextResponse.json({
      providers: availableProviders,
      default: 'openai'
    })
  } catch (error) {
    console.error('Error checking providers:', error)
    return NextResponse.json(
      { error: 'Failed to check available providers' },
      { status: 500 }
    )
  }
}
