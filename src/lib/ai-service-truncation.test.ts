import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenAIService } from './ai-service'

// A response that parses successfully but is missing the trailing top-level
// `translation` and `summary` fields — exactly the shape produced when the
// model hits max_tokens mid-stream after the sentences array completed.
const truncatedContent = JSON.stringify({
  extractedText: '国旗法案',
  // translation + summary intentionally omitted
  sentences: [
    {
      sentence: '国旗',
      translation: 'flag',
      words: [],
      grammar: [],
      context: 'test'
    }
  ]
})

const mockOkResponse = (content: string): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] })
  }) as unknown as Response

describe('OpenAIService analyzeText truncation salvage', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  afterEach(() => {
    fetchSpy.mockReset()
  })

  it('returns a partial result instead of throwing when the response is truncated', async () => {
    fetchSpy.mockResolvedValue(mockOkResponse(truncatedContent))

    const service = new OpenAIService('test-key', 'test-model')
    const result = await service.analyzeText('国旗法案。', 'zh', true)

    // Reached here without throwing — the salvage path degraded gracefully.
    expect(result.provider).toBe('openai')
    expect(result.sentences.length).toBeGreaterThan(0)
    expect(result.sentences[0].sentence).toBe('国旗')
    expect(result.sentences[0].translation).toBe('flag')
    // Salvage flags the result as partial so the UI can surface it.
    expect(result.translation).toMatch(/truncat/i)
  })

  it('still throws when nothing in the truncated response is salvageable', async () => {
    // No extractedText and no complete sentence — salvage returns null and the
    // original "Invalid analysis result structure" throw stands.
    const unsalvageable = JSON.stringify({ foo: 'bar' })
    fetchSpy.mockResolvedValue(mockOkResponse(unsalvageable))

    const service = new OpenAIService('test-key', 'test-model')
    await expect(service.analyzeText('国旗法案。', 'zh', true)).rejects.toThrow()
  })
})
