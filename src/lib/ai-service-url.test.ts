import { afterEach, describe, expect, it } from 'vitest'
import { OpenAIService } from './ai-service'

const originalBaseUrl = process.env.OPENAI_BASE_URL
const originalModel = process.env.OPENAI_MODEL

afterEach(() => {
  // Restore env between tests; OpenAIService reads env in its constructor.
  if (originalBaseUrl === undefined) delete process.env.OPENAI_BASE_URL
  else process.env.OPENAI_BASE_URL = originalBaseUrl
  if (originalModel === undefined) delete process.env.OPENAI_MODEL
  else process.env.OPENAI_MODEL = originalModel
})

describe('OpenAIService chat completions URL', () => {
  it('defaults to the official OpenAI endpoint when OPENAI_BASE_URL is unset', () => {
    delete process.env.OPENAI_BASE_URL
    const service = new OpenAIService('key', 'gpt-4o')
    expect(service.chatCompletionsUrl).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('uses a versioned OPENAI_BASE_URL directly (ARK /api/v3)', () => {
    process.env.OPENAI_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
    const service = new OpenAIService('key', 'doubao-seed-evolving')
    expect(service.chatCompletionsUrl).toBe('https://ark.cn-beijing.volces.com/api/v3/chat/completions')
  })

  it('does not double the /v1 segment when OPENAI_BASE_URL already ends with /v1', () => {
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1'
    const service = new OpenAIService('key', 'gpt-4o')
    expect(service.chatCompletionsUrl).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('appends /v1 when OPENAI_BASE_URL is a bare host with no version segment', () => {
    process.env.OPENAI_BASE_URL = 'https://proxy.example.com'
    const service = new OpenAIService('key', 'gpt-4o')
    expect(service.chatCompletionsUrl).toBe('https://proxy.example.com/v1/chat/completions')
  })

  it('strips trailing slashes from OPENAI_BASE_URL', () => {
    process.env.OPENAI_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/'
    const service = new OpenAIService('key', 'doubao-seed-evolving')
    expect(service.chatCompletionsUrl).toBe('https://ark.cn-beijing.volces.com/api/v3/chat/completions')
  })
})
