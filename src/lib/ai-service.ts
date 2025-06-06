import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider, OpenAIFormatSettings, ModelSettings, MangaAnalysisResult, PanelSegmentationResult, SegmentedPanel, MangaPanel } from './types'
import { ClientPanelSegmentationService } from './client-panel-segmentation'
import { ImprovedTextDetectionService } from './improved-text-detection'

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
      "translation": "English translation of this panel's text",
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
          "pattern": "Grammar pattern found in this panel",
          "explanation": "Detailed explanation of the grammar pattern",
          "example": "Example sentence using this pattern"
        }
      ],
      "context": "What's happening in this specific panel"
    }
  ],
  "overallSummary": "Overall summary of the entire manga page/scene",
  "readingOrder": [1, 2, 3, 4]
}

Focus on:
1. Identifying individual manga panels (speech bubbles, panel borders, distinct scenes)
2. Reading order: RIGHT to LEFT, TOP to BOTTOM (traditional Japanese manga layout)
3. Extracting text from each panel separately
4. Analyzing vocabulary and grammar for each panel individually
5. Providing context for each panel's content
6. Including sound effects (onomatopoeia) and their meanings
7. Recognizing different types of text (dialogue, thoughts, narration, sound effects)
8. Difficulty levels: beginner (JLPT N5-N4), intermediate (N3-N2), advanced (N1+)

Make sure the response is valid JSON format.`

// Helper function to clean JSON responses that might be wrapped in markdown
function cleanJsonResponse(content: string): string {
  // Remove markdown code block wrappers if present
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/
  const match = content.match(codeBlockRegex)
  
  if (match) {
    return match[1].trim()
  }
  
  // If no code blocks found, return original content trimmed
  return content.trim()
}

export class OpenAIService {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey
    this.model = model || process.env.OPENAI_MODEL || 'gpt-4-vision-preview'
  }

  async analyzeText(text: string): Promise<AnalysisResult> {
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

    const analysisResult = JSON.parse(cleanJsonResponse(content))
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

    const analysisResult = JSON.parse(cleanJsonResponse(content))
    return {
      ...analysisResult,
      provider: 'openai' as AIProvider
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
                  url: `data:image/jpeg;base64,${imageBase64}`
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

    const analysisResult = JSON.parse(cleanJsonResponse(content))
    return {
      ...analysisResult,
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
    this.model = this.genAI.getGenerativeModel({ model: finalModelName })
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

    const analysisResult = JSON.parse(cleanJsonResponse(content))
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

    const analysisResult = JSON.parse(cleanJsonResponse(content))
    return {
      ...analysisResult,
      provider: 'gemini' as AIProvider
    }
  }

  async analyzeMangaImage(imageBase64: string): Promise<MangaAnalysisResult> {
    const prompt = MANGA_PANEL_ANALYSIS_PROMPT()
    
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

    const analysisResult = JSON.parse(cleanJsonResponse(content))
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

    const analysisResult = JSON.parse(cleanJsonResponse(content))
    return {
      ...analysisResult,
      provider: 'openai-format' as AIProvider
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

    const analysisResult = JSON.parse(cleanJsonResponse(content))
    return {
      ...analysisResult,
      provider: 'openai-format' as AIProvider
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
                  url: `data:image/jpeg;base64,${imageBase64}`
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

    const analysisResult = JSON.parse(cleanJsonResponse(content))
    return {
      ...analysisResult,
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
      if (geminiModel) {
        this.geminiService = new GeminiService(geminiApiKey, geminiModel)
      } else {
        // Check if environment variable has a model as fallback
        const envModel = process.env.GEMINI_MODEL?.trim()
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
            console.log(`🔍 Analyzing panel ${index + 1} with improved text detection...`)
            
            // Use improved text detection service
            const panelAnalysis = await this.improvedTextDetection.analyzePanel(
              segmentedPanel.imageData,
              this,
              provider,
              index + 1
            )
            
            // Set the position from segmentation result
            panelAnalysis.position = segmentedPanel.boundingBox
            
            return panelAnalysis
          } catch (error) {
            console.error(`❌ Error analyzing panel ${index + 1}:`, error)
            return {
              panelNumber: index + 1,
              position: segmentedPanel.boundingBox,
              imageData: segmentedPanel.imageData,
              extractedText: '',
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

  private async analyzeMangaImageDirect(imageBase64: string, provider: AIProvider = 'openai'): Promise<MangaAnalysisResult> {
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

    return {
      ...result,
      panels: enhancedPanels
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
