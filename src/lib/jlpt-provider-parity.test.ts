import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootService = readFileSync('src/lib/ai-service.ts', 'utf8')
const netlifyService = readFileSync('netlify/src/lib/ai-service.ts', 'utf8')

describe('JLPT provider parity', () => {
  it('does not hardcode N5 exclusion in either reading-mode service', () => {
    expect(rootService).not.toContain('getLearningLevelInstruction(true)')
    expect(netlifyService).not.toContain('getLearningLevelInstruction(true)')
  })
})
