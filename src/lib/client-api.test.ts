import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeText } from './client-api'

describe('analyzeText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts text, provider, and Chinese default language to the analysis endpoint', async () => {
    const analysisResult = {
      extractedText: 'こんにちは',
      sentences: [],
      translation: 'Hello',
      summary: 'Greeting',
      provider: 'openai-format'
    }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(analysisResult), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await analyzeText('こんにちは', { provider: 'openai-format' })

    expect(fetchMock).toHaveBeenCalledWith('/api/analyze', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({
      text: 'こんにちは',
      provider: 'openai-format',
      analysisLanguage: 'zh',
      excludeN5: true
    })
    expect(result).toEqual(analysisResult)
  })

  it('surfaces API error messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'No AI service configured' }),
      { status: 500, statusText: 'Internal Server Error' }
    )))

    await expect(analyzeText('こんにちは')).rejects.toThrow('No AI service configured')
  })
})
