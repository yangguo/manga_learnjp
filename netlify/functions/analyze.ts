import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { AIAnalysisService, type AnalysisResult } from '../src/lib/ai-service'
import { type AIProvider, type OpenAIFormatSettings, type ModelSettings, type APIKeySettings, type MangaAnalysisResult, type ReadingModeResult } from '../src/lib/types'

// Simple in-memory cache to track failed endpoints (resets on function restart)
const failedEndpoints = new Map<string, number>() // endpoint -> timestamp of last failure
const slowEndpoints = new Map<string, number>() // endpoint -> timestamp of last slow response

interface AnalysisRequest {
  text?: string
  imageBase64?: string
  provider?: AIProvider
  openaiFormatSettings?: OpenAIFormatSettings
  modelSettings?: ModelSettings
  apiKeySettings?: APIKeySettings
  mangaMode?: boolean
  simpleAnalysisMode?: boolean // New flag to distinguish simple analysis from panel analysis
  readingMode?: boolean // New flag for reading mode analysis
}

// Quick endpoint reachability check to avoid slow connect timeouts
async function isEndpointReachable(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    // Test with a minimal POST request to chat/completions to simulate real usage
    const chatUrl = `${url}/chat/completions`
    const startTime = Date.now()
    const res = await fetch(chatUrl, { 
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'test',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      })
    })
    clearTimeout(timeoutId)
    
    const responseTime = Date.now() - startTime
    
    // Even 400/401/403 responses mean the endpoint is working, just auth/validation issues
    // Only 500+ or network errors indicate the endpoint is problematic
    const isWorking = res.status < 500
    
    console.log(`🔍 Preflight POST test: ${res.status} ${res.statusText} (took ${responseTime}ms)`)
    
    // If it took more than 3 seconds, consider it too slow
    if (responseTime > 3000) {
      console.log(`🐌 Endpoint response time ${responseTime}ms is too slow, marking as slow`)
      const endpointUrl = url.replace(/\/$/, '')
      slowEndpoints.set(endpointUrl, Date.now())
    }
    
    return isWorking
  } catch (error) {
    console.log('🔍 Endpoint reachability check failed:', error instanceof Error ? error.message : 'Unknown error')
    // Don't assume the endpoint is reachable if we can't reach it
    console.log('🔧 Endpoint is not reachable')
    return false
  }
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Check for Netlify CLI environment and warn about timeout issues
  if (process.env.NETLIFY_DEV === 'true' || process.env.NETLIFY_LOCAL === 'true') {
    console.log('⚠️  Running in Netlify CLI environment - timeout issues may occur with slow endpoints')
    console.log('💡 Consider using faster endpoints or reducing image complexity for local testing')
  }

  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const { text, imageBase64, provider = 'openai', openaiFormatSettings, modelSettings, apiKeySettings, mangaMode = false, simpleAnalysisMode = false, readingMode = false }: AnalysisRequest = JSON.parse(event.body || '{}')

    if (!text && !imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Either text or image is required for analysis' }),
      }
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
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'No AI service configured. Please:\n• Set OpenAI API key and select "OpenAI" provider, or\n• Set Gemini API key and select "Gemini" provider, or\n• Configure OpenAI-Compatible API with valid endpoint and model' 
        }),
      }
    }

    const aiService = new AIAnalysisService(
      openaiApiKey, 
      geminiApiKey, 
      finalOpenAIFormatSettings,
      modelSettings
    )
    const availableProviders = aiService.getAvailableProviders()

    if (availableProviders.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'No AI providers available. Please check your API keys or OpenAI-format settings.' }),
      }
    }

    // Try providers in order: requested provider first, then all available providers
    let providersToTry = availableProviders.includes(provider) 
      ? [provider, ...availableProviders.filter(p => p !== provider)]
      : availableProviders

    // If openai-format is configured, check if it should be skipped
    if (finalOpenAIFormatSettings && providersToTry.includes('openai-format')) {
      const endpointUrl = finalOpenAIFormatSettings.endpoint.replace(/\/$/, '')
      
      // Check if this endpoint failed recently (within last 5 minutes)
      const lastFailure = failedEndpoints.get(endpointUrl)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      
      // Check if this endpoint was slow recently (within last 10 minutes)
      const lastSlow = slowEndpoints.get(endpointUrl)
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000
      
      if (lastFailure && lastFailure > fiveMinutesAgo) {
        console.log('⚠️ OpenAI-format endpoint failed recently, skipping to avoid repeated slow timeouts:', endpointUrl)
        providersToTry = providersToTry.filter(p => p !== 'openai-format')
      } else if (lastSlow && lastSlow > tenMinutesAgo) {
        console.log('🐌 OpenAI-format endpoint was slow recently, skipping to avoid long wait times:', endpointUrl)
        providersToTry = providersToTry.filter(p => p !== 'openai-format')
      } else {
        console.log('🔍 Checking reachability of OpenAI-format endpoint:', endpointUrl)
        const reachable = await isEndpointReachable(endpointUrl)
        console.log('📡 Endpoint reachability result:', reachable)
        if (!reachable) {
          console.log('⚠️ OpenAI-format endpoint appears unreachable, skipping provider to avoid slow timeouts:', endpointUrl)
          failedEndpoints.set(endpointUrl, Date.now()) // Cache the failure
          providersToTry = providersToTry.filter(p => p !== 'openai-format')
        } else {
          console.log('✅ OpenAI-format endpoint appears reachable, proceeding with provider')
          
          // Additional warning for Netlify CLI users about potential timeout issues
          if (process.env.NETLIFY_DEV === 'true' || process.env.NETLIFY_LOCAL === 'true') {
            console.log('⚠️ Netlify CLI Warning: OpenAI-format may timeout at 90s. Consider using OpenAI/Gemini APIs for faster results')
          }
        }
      }
      console.log('📋 Updated providers to try:', providersToTry)
    }
    
    // If openai-format is the only provider left and it's slow/unreliable, warn the user
    if (finalOpenAIFormatSettings && providersToTry.length === 1 && providersToTry[0] === 'openai-format') {
      const endpointUrl = finalOpenAIFormatSettings.endpoint.replace(/\/$/, '')
      if (failedEndpoints.has(endpointUrl) || slowEndpoints.has(endpointUrl)) {
        console.log('⚠️ Warning: Only OpenAI-format provider available, but it has performance issues')
        console.log('💡 Recommendation: Configure OpenAI or Gemini API keys for better reliability')
      }
    }

    let lastError: Error | null = null
    
    for (const currentProvider of providersToTry) {
      const startTime = Date.now()
      try {
        console.log(`🔄 Trying provider: ${currentProvider}`)
        
        let result: AnalysisResult | MangaAnalysisResult | ReadingModeResult
        if (imageBase64) {
          if (readingMode) {
            result = await aiService.analyzeImageForReading(imageBase64, currentProvider)
          } else if (mangaMode) {
            result = await aiService.analyzeMangaImage(imageBase64, currentProvider)
          } else if (simpleAnalysisMode) {
            // In simple mode, use manga analysis but skip client-side segmentation
            // This will fall back to LLM-based analysis and display using panel UI
            result = await aiService.analyzeMangaImageDirect(imageBase64, currentProvider)
          } else {
            // Regular individual panel analysis or simple image analysis
            result = await aiService.analyzeImage(imageBase64, currentProvider)
          }
        } else {
          result = await aiService.analyzeText(text!, currentProvider)
        }
        
        console.log(`✅ Success with provider: ${currentProvider} (took ${Date.now() - startTime}ms)`)
        
        // If this was a slow response from openai-format, cache it as slow
        if (currentProvider === 'openai-format' && finalOpenAIFormatSettings && (Date.now() - startTime) > 60000) {
          const endpointUrl = finalOpenAIFormatSettings.endpoint.replace(/\/$/, '')
          slowEndpoints.set(endpointUrl, Date.now())
          console.log(`🐌 OpenAI-format endpoint is slow, caching for future requests`)
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result),
        }
        
      } catch (error) {
        console.log(`❌ Provider ${currentProvider} failed:`, error instanceof Error ? error.message : 'Unknown error')
        
        // If openai-format provider failed, cache the failure to avoid repeated attempts
        if (currentProvider === 'openai-format' && finalOpenAIFormatSettings) {
          const endpointUrl = finalOpenAIFormatSettings.endpoint.replace(/\/$/, '')
          failedEndpoints.set(endpointUrl, Date.now())
          console.log('💾 Cached openai-format failure to avoid repeated slow requests')
        }
        
        lastError = error instanceof Error ? error : new Error('Unknown error')
        continue
      }
    }

    // If no providers available to try (e.g., openai-format unreachable and no other providers), fail fast
    if (providersToTry.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'OpenAI-compatible endpoint appears unreachable. Configure OpenAI or Gemini API keys, or update the OpenAI-format endpoint/model in settings.'
        }),
      }
    }

    // If all providers failed, throw the last error
    throw lastError || new Error('All providers failed')

  } catch (error) {
    console.error('Analysis error:', error)
    
    // Extract mangaMode from the request for error handling
    let mangaMode = false
    try {
      const requestBody = JSON.parse(event.body || '{}')
      mangaMode = requestBody.mangaMode || false
    } catch {
      // If we can't parse the request, default to false
    }
    
    // Check if this is a timeout error and provide a more specific message
    const isTimeoutError = error instanceof Error && (
      error.message.includes('timeout') ||
      error.message.includes('AbortError') ||
      error.message.includes('aborted') ||
      error.name === 'AbortError'
    )
    
    // Check if this is specifically an OpenAI-format timeout
    const isOpenAIFormatTimeout = error instanceof Error && error.message.includes('OpenAI-format')
    
    // Return fallback response if analysis fails
    if (mangaMode) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          panels: [],
          overallSummary: isTimeoutError ? 
            (isOpenAIFormatTimeout ? 
              "OpenAI-compatible endpoint is too slow. Please try again later, use a faster endpoint, or configure OpenAI/Gemini API keys for better performance." :
              "Analysis timed out. Please try again or check your endpoint configuration.") : 
            "Unable to analyze manga panels at this time.",
          readingOrder: [],
          provider: 'fallback' as AIProvider,
          error: error instanceof Error ? error.message : 'Failed to analyze manga'
        }),
      }
    } else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          extractedText: "Unable to extract text from image",
          translation: isTimeoutError ? 
            (isOpenAIFormatTimeout ? 
              "OpenAI-compatible endpoint is too slow. Please try again later, use a faster endpoint, or configure OpenAI/Gemini API keys." :
              "Analysis timed out. Please try again or check your endpoint configuration.") : 
            "Translation analysis failed. Please try again.",
          summary: isTimeoutError ? 
            (isOpenAIFormatTimeout ? 
              "Analysis failed due to slow OpenAI-compatible endpoint response." :
              "Analysis timed out due to slow response from the AI service.") : 
            "Unable to analyze the context at this time.",
          words: [],
          grammar: [],
          provider: 'fallback' as AIProvider,
          error: error instanceof Error ? error.message : 'Failed to analyze text'
        }),
      }
    }
  }
}