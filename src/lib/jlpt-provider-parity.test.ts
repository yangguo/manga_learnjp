import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootService = readFileSync('src/lib/ai-service.ts', 'utf8')
const netlifyService = readFileSync('netlify/src/lib/ai-service.ts', 'utf8')
const grammarInstruction = 'In "grammar", return standard grammar constructions (including N5) but exclude isolated particles, bare inflections, and punctuation.'

describe('JLPT provider parity', () => {
  it('does not hardcode N5 exclusion in either reading-mode service', () => {
    expect(rootService).not.toContain('getLearningLevelInstruction(true)')
    expect(netlifyService).not.toContain('getLearningLevelInstruction(true)')
  })

  it('uses the same deterministic-grammar prompt in both provider mirrors', () => {
    expect(rootService).toContain(grammarInstruction)
    expect(netlifyService).toContain(grammarInstruction)
    expect(rootService).toContain('Do not assign JLPT levels; the client uses a static dictionary.')
    expect(netlifyService).toContain('Do not assign JLPT levels; the client uses a static dictionary.')
  })
})
