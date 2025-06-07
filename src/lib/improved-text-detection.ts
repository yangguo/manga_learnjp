/**
 * Improved Text Detection Service
 * Addresses issues where text is not detected in some panels
 */

import type { AIProvider, MangaPanel, SegmentedPanel } from './types'
import { createImageDataURL, getImageMimeType } from './image-utils'

export interface TextDetectionOptions {
  // Minimum confidence threshold for text detection
  minConfidence?: number
  // Whether to use OCR preprocessing
  useOCRPreprocessing?: boolean
  // Whether to retry with different prompts if no text is found
  enableRetry?: boolean
  // Maximum number of retry attempts
  maxRetries?: number
}

export class ImprovedTextDetectionService {
  private defaultOptions: TextDetectionOptions = {
    minConfidence: 0.5,
    useOCRPreprocessing: true,
    enableRetry: true,
    maxRetries: 2
  }

  constructor(private options: TextDetectionOptions = {}) {
    this.options = { ...this.defaultOptions, ...options }
  }

  /**
   * Enhanced text detection prompt that's more explicit about finding text
   */
  private getEnhancedTextDetectionPrompt(): string {
    return `
You are an expert Japanese text extraction specialist for manga analysis. Your primary task is to find and extract ALL Japanese text from this manga panel image.

IMPORTANT INSTRUCTIONS:
1. Look VERY CAREFULLY for ANY Japanese text, including:
   - Speech bubbles (dialogue)
   - Thought bubbles (internal monologue)
   - Sound effects (onomatopoeia) - even small ones
   - Signs, labels, or background text
   - Narration boxes
   - Small text or whispers
   - Text that might be partially obscured

2. Even if the text is:
   - Very small or faint
   - Partially cut off
   - Stylized or decorative
   - Sound effects written in katakana
   - Single characters or short phrases
   
   STILL INCLUDE IT in your extraction.

3. If you find ANY Japanese text at all, include it in the "extractedText" field.
4. If you genuinely cannot find any Japanese text after careful examination, set "extractedText" to an empty string "".
5. Do NOT assume there's no text just because the image quality is poor or the text is small.

Provide your response in this JSON format:
{
  "extractedText": "All Japanese text found (or empty string if none)",
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
  "summary": "Brief description of what's shown in this panel",
  "confidence": 0.95,
  "textLocations": [
    {
      "text": "specific text found",
      "type": "dialogue|sound_effect|narration|sign",
      "position": "description of where the text appears"
    }
  ],
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
      "pattern": "Grammar pattern found",
      "explanation": "Explanation of the pattern",
      "example": "Example usage"
    }
  ]
}

Remember: It's better to extract text that might be uncertain than to miss text that's actually there.`
  }

  /**
   * Fallback prompt for when initial detection finds no text
   */
  private getFallbackPrompt(): string {
    return `
Please examine this manga panel image one more time with extra attention to detail.

Sometimes Japanese text in manga can be:
- Very small sound effects (like "ドキドキ", "ザー", "ピッ", etc.)
- Single character exclamations (like "あ", "え", "！", etc.)
- Text integrated into the artwork
- Faded or low-contrast text
- Text in unusual fonts or styles

Look in these specific areas:
1. Around character mouths (speech)
2. Near action scenes (sound effects)
3. Corners and edges of the panel
4. Background elements
5. Any speech or thought bubbles, even small ones

If you find ANY Japanese characters, please extract them. If after this careful examination you still find no Japanese text, respond with an empty extractedText field.

Use the same JSON format as before.`
  }

  /**
   * Analyze a panel with improved text detection
   */
  async analyzePanel(
    panelImageBase64: string,
    aiService: any,
    provider: AIProvider,
    panelNumber: number
  ): Promise<MangaPanel> {
    let attempts = 0
    let lastResult: any = null

    while (attempts <= (this.options.maxRetries || 2)) {
      try {
        const prompt = attempts === 0 
          ? this.getEnhancedTextDetectionPrompt()
          : this.getFallbackPrompt()

        // Use the AI service with our enhanced prompt
        const result = await this.callAIWithCustomPrompt(
          aiService,
          provider,
          panelImageBase64,
          prompt
        )

        lastResult = result

        // If we found text or this is our last attempt, return the result
        if (result.extractedText && result.extractedText.trim().length > 0) {
          console.log(`✅ Text found in panel ${panelNumber} on attempt ${attempts + 1}:`, result.extractedText)
          break
        } else if (attempts >= (this.options.maxRetries || 2)) {
          console.log(`⚠️ No text found in panel ${panelNumber} after ${attempts + 1} attempts`)
          break
        } else {
          console.log(`🔄 No text found in panel ${panelNumber}, retrying with fallback prompt...`)
        }

        attempts++
      } catch (error) {
        console.error(`❌ Error analyzing panel ${panelNumber} on attempt ${attempts + 1}:`, error)
        if (attempts >= (this.options.maxRetries || 2)) {
          break
        }
        attempts++
      }
    }

    // Return the best result we got
    return {
      panelNumber,
      position: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      }, // Default position, will be set by caller
      imageData: panelImageBase64,
      extractedText: lastResult?.extractedText || '',
      sentences: lastResult?.sentences || [], // Sentence breakdown from AI analysis
      translation: lastResult?.translation || 'No text to translate',
      words: lastResult?.words || [],
      grammar: lastResult?.grammar || [],
      context: lastResult?.summary || 'Panel analysis completed'
    }
  }

  /**
   * Call AI service with custom prompt
   */
  private async callAIWithCustomPrompt(
    aiService: any,
    provider: AIProvider,
    imageBase64: string,
    customPrompt: string
  ): Promise<any> {
    // This would need to be implemented based on the specific AI service structure
    // For now, we'll use the existing analyzeImage method
    // In a real implementation, you'd want to modify the AI services to accept custom prompts
    
    if (provider === 'openai' && aiService.openaiService) {
      return await this.callOpenAIWithCustomPrompt(aiService.openaiService, imageBase64, customPrompt)
    } else if (provider === 'gemini' && aiService.geminiService) {
      return await this.callGeminiWithCustomPrompt(aiService.geminiService, imageBase64, customPrompt)
    } else {
      // Fallback to regular analysis
      return await aiService.analyzeImage(imageBase64, provider)
    }
  }

  /**
   * Call OpenAI with custom prompt
   */
  private async callOpenAIWithCustomPrompt(openaiService: any, imageBase64: string, customPrompt: string): Promise<any> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiService.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openaiService.model || 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Japanese text extraction specialist for manga analysis. Focus on finding ALL Japanese text in the image, no matter how small or faint.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: customPrompt
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
        temperature: 0.1, // Lower temperature for more consistent text extraction
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

    // Clean and parse JSON response
    const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim()
    return JSON.parse(cleanContent)
  }

  /**
   * Call Gemini with custom prompt
   */
  private async callGeminiWithCustomPrompt(geminiService: any, imageBase64: string, customPrompt: string): Promise<any> {
    // Convert base64 to format Gemini expects
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: getImageMimeType(imageBase64)
      }
    }

    const result = await geminiService.model.generateContent([
      customPrompt,
      imagePart
    ])

    const response = await result.response
    const content = response.text()

    if (!content) {
      throw new Error('No content received from Gemini')
    }

    // Parse JSON response, handling potential markdown formatting
    const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim()
    return JSON.parse(cleanContent)
  }

  /**
   * Preprocess image for better OCR (optional enhancement)
   */
  private async preprocessImageForOCR(imageBase64: string): Promise<string> {
    // This could include:
    // - Contrast enhancement
    // - Noise reduction
    // - Text region detection
    // - Image sharpening
    // For now, return the original image
    return imageBase64
  }

  /**
   * Post-process extracted text to clean it up
   */
  private cleanExtractedText(text: string): string {
    if (!text) return ''
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
  }
}

export default ImprovedTextDetectionService