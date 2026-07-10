import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeImage, analyzeImageForReading, analyzeText } from './client-api'

vi.mock('./jlpt-dictionary', () => ({
  getJLPTDictionary: vi.fn(async () => ({
    status: 'ready',
    dictionary: {
      datasetVersion: 'test-v1',
      classify: () => ({
        level: 'N5',
        source: 'open-anki-jlpt-decks',
        datasetVersion: 'test-v1',
        match: 'exact'
      })
    }
  }))
}))

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
    })
    expect(result.jlptCalibration).toMatchObject({ status: 'ready', persistable: true })
  })

  it('surfaces API error messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'No AI service configured' }),
      { status: 500, statusText: 'Internal Server Error' }
    )))

    await expect(analyzeText('こんにちは')).rejects.toThrow('No AI service configured')
  })

  it('does not retry transient API errors (server owns retry)', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ error: 'fetch failed' }),
      { status: 500, statusText: 'Internal Server Error' }
    ))
    vi.stubGlobal('fetch', fetchMock)

    await expect(analyzeText('こんにちは', { provider: 'openai-format' })).rejects.toThrow('fetch failed')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry non-transient API errors', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ error: 'No AI service configured' }),
      { status: 500, statusText: 'Internal Server Error' }
    ))
    vi.stubGlobal('fetch', fetchMock)

    await expect(analyzeText('こんにちは')).rejects.toThrow('No AI service configured')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborts an in-flight text analysis request when the caller aborts', async () => {
    const controller = new AbortController()
    let capturedSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        capturedSignal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const request = analyzeText('こんにちは', { signal: controller.signal })
    controller.abort()

    await expect(request).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(capturedSignal?.aborted).toBe(true)
  })
})

describe('analyzeImageForReading', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts image, provider, and Chinese default language to reading analysis', async () => {
    const readingResult = {
      sentences: [],
      imageData: 'data:image/jpeg;base64,abc',
      overallSummary: 'Summary',
      provider: 'openai-format'
    }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(readingResult), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await analyzeImageForReading('abc', { provider: 'openai-format' })

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({
      imageBase64: 'abc',
      provider: 'openai-format',
      readingMode: true,
      analysisLanguage: 'zh'
    })
    expect(result.jlptCalibration).toMatchObject({ status: 'ready', persistable: true })
  })

  it('can request English reading analysis', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      sentences: [],
      imageData: 'data:image/jpeg;base64,abc',
      overallSummary: 'Summary',
      provider: 'openai'
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await analyzeImageForReading('abc', { provider: 'openai', language: 'en' })

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.analysisLanguage).toBe('en')
  })
})

describe('analyzeImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts a full-page image request without excludeN5', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      extractedText: '猫',
      sentences: [{
        sentence: '猫',
        translation: 'cat',
        words: [{ word: '猫', reading: 'ねこ', meaning: 'cat', partOfSpeech: 'noun' }],
        grammar: [],
        context: ''
      }],
      translation: 'cat',
      summary: '',
      provider: 'openai'
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await analyzeImage('abc', { provider: 'openai-format' })

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toEqual({
      imageBase64: 'abc',
      provider: 'openai-format',
      mangaMode: false,
      analysisLanguage: 'zh'
    })
    expect(result.sentences[0].words[0].jlpt.level).toBe('N5')
  })
})
