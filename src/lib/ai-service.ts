import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider, OpenAIFormatSettings } from './types'

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
  "translation": "English translation of the text",
  "summary": "Brief context summary explaining what's happening in this manga scene",
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
      "pattern": "Grammar pattern found in text",
      "explanation": "Detailed explanation of the grammar pattern",
      "example": "Example sentence using this pattern"
    }
  ]
}

Focus on:
1. ${text ? '' : 'First, accurately extracting ALL Japanese text from the manga image (including text in speech bubbles, sound effects, signs, etc.)'} 
2. Breaking down important vocabulary words, especially those that might be difficult for learners
3. Identifying key grammar patterns and structures
4. Providing context for manga-specific language or expressions
5. Assigning appropriate difficulty levels (beginner: JLPT N5-N4, intermediate: N3-N2, advanced: N1+)
6. Including furigana readings for kanji
7. Explaining any colloquialisms, slang, or casual speech patterns common in manga
8. ${text ? '' : 'Recognizing manga sound effects (onomatopoeia) and their meanings'}

Make sure the response is valid JSON format.`

export class OpenAIService {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async analyzeText(text: string): Promise<AnalysisResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
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

    const analysisResult = JSON.parse(content)
    return {
      ...analysisResult,
      provider: 'openai' as AIProvider
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
        model: 'gpt-4-vision-preview',
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
                  url: `data:image/jpeg;base64,${imageBase64}`
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

    const analysisResult = JSON.parse(content)
    return {
      ...analysisResult,
      provider: 'openai' as AIProvider
    }
  }
}

export class GeminiService {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
  }

  async analyzeText(text: string): Promise<AnalysisResult> {
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

    // Clean up the response to extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Gemini')
    }

    const analysisResult = JSON.parse(jsonMatch[0])
    return {
      ...analysisResult,
      provider: 'gemini' as AIProvider
    }
  }

  async analyzeImage(imageBase64: string): Promise<AnalysisResult> {
    const prompt = ANALYSIS_PROMPT()
    
    // Convert base64 to format Gemini expects
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: 'image/jpeg'
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

    // Clean up the response to extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Gemini')
    }

    const analysisResult = JSON.parse(jsonMatch[0])
    return {
      ...analysisResult,
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
      throw new Error(`OpenAI-format API error: ${response.status} - ${await response.text()}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI-format API')
    }

    try {
      const analysisResult = JSON.parse(content)
      return {
        ...analysisResult,
        provider: 'openai-format' as AIProvider
      }
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${content}`)
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
                  url: `data:image/jpeg;base64,${imageBase64}`
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
      throw new Error(`OpenAI-format API error: ${response.status} - ${await response.text()}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from OpenAI-format API')
    }

    try {
      const analysisResult = JSON.parse(content)
      return {
        ...analysisResult,
        provider: 'openai-format' as AIProvider
      }
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${content}`)
    }
  }
}

export class AIAnalysisService {
  private openaiService?: OpenAIService
  private geminiService?: GeminiService
  private openaiFormatService?: OpenAIFormatService

  constructor(openaiKey?: string, geminiKey?: string, openaiFormatSettings?: OpenAIFormatSettings) {
    if (openaiKey) {
      this.openaiService = new OpenAIService(openaiKey)
    }
    if (geminiKey) {
      this.geminiService = new GeminiService(geminiKey)
    }
    if (openaiFormatSettings) {
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

  getAvailableProviders(): AIProvider[] {
    const providers: AIProvider[] = []
    if (this.openaiService) providers.push('openai')
    if (this.geminiService) providers.push('gemini')
    if (this.openaiFormatService) providers.push('openai-format')
    return providers
  }
}
