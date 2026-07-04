import { describe, expect, it } from 'vitest'
import {
  MOKURO_ANALYSIS_CACHE_FILENAME,
  clampPageRange,
  createMokuroAnalysisCacheKey,
  createMokuroImageLookup,
  findMokuroPageImageFile,
  getMokuroBlockText,
  planMokuroDirectoryImport,
  parseMokuroAnalysisCacheContent,
  serializeMokuroAnalysisCache,
  parseMokuroFileContent
} from './mokuro'

describe('parseMokuroFileContent', () => {
  it('parses a Mokuro file and normalizes block text', () => {
    const parsed = parseMokuroFileContent(JSON.stringify({
      version: '0.2.0',
      title: 'spy1',
      pages: [
        {
          version: '0.2.0',
          img_width: 1200,
          img_height: 1800,
          img_path: 'spy1/page-001.jpg',
          blocks: [
            {
              box: [10, 20, 110, 220],
              vertical: true,
              font_size: 28,
              lines: [' おはよう ', '', 'ございます']
            }
          ]
        }
      ]
    }))

    expect(parsed.title).toBe('spy1')
    expect(parsed.pages).toHaveLength(1)
    expect(parsed.pages[0].img_width).toBe(1200)
    expect(parsed.pages[0].blocks[0].box).toEqual([10, 20, 110, 220])
    expect(getMokuroBlockText(parsed.pages[0].blocks[0])).toBe('おはよう\nございます')
  })

  it('rejects malformed Mokuro JSON with a helpful message', () => {
    expect(() => parseMokuroFileContent('{bad json')).toThrow(/valid JSON/)
    expect(() => parseMokuroFileContent(JSON.stringify({ pages: [] }))).toThrow(/at least one page/)
    expect(() => parseMokuroFileContent(JSON.stringify({
      pages: [
        {
          img_width: 0,
          img_height: 1800,
          img_path: 'page-001.jpg',
          blocks: []
        }
      ]
    }))).toThrow(/invalid page 1/)
  })
})

describe('mokuro image lookup', () => {
  it('matches page image paths by exact path and basename', () => {
    const exactFile = { name: 'page-001.jpg' }
    const nestedFile = { name: 'page-002.jpg', webkitRelativePath: 'spy1/images/page-002.jpg' }
    const lookup = createMokuroImageLookup([exactFile, nestedFile])

    expect(findMokuroPageImageFile({ img_path: 'page-001.jpg' }, lookup)).toBe(exactFile)
    expect(findMokuroPageImageFile({ img_path: './spy1/images/page-002.jpg' }, lookup)).toBe(nestedFile)
    expect(findMokuroPageImageFile({ img_path: 'missing.jpg' }, lookup)).toBeNull()
  })
})

describe('mokuro directory import planning', () => {
  it('finds the Mokuro file, page images, and saved cache from one directory selection', () => {
    const mokuroFile = { name: 'spy6.mokuro', webkitRelativePath: 'spy6-output/spy6.mokuro' }
    const imageFile = { name: 'page-001.jpg', webkitRelativePath: 'spy6-output/spy6/page-001.jpg' }
    const cacheFile = { name: MOKURO_ANALYSIS_CACHE_FILENAME, webkitRelativePath: `spy6-output/${MOKURO_ANALYSIS_CACHE_FILENAME}` }
    const ignoredFile = { name: 'page-001.json', webkitRelativePath: 'spy6-output/spy6/page-001.json' }

    const plan = planMokuroDirectoryImport([ignoredFile, imageFile, cacheFile, mokuroFile])

    expect(plan.mokuroFile).toBe(mokuroFile)
    expect(plan.imageFiles).toEqual([imageFile])
    expect(plan.cacheFile).toBe(cacheFile)
  })

  it('rejects directory selections without a Mokuro file', () => {
    expect(() => planMokuroDirectoryImport([
      { name: 'page-001.jpg', webkitRelativePath: 'spy6/page-001.jpg' }
    ])).toThrow(/No .mokuro file/)
  })
})

describe('mokuro analysis cache', () => {
  const result = {
    extractedText: 'こんにちは',
    sentences: [],
    translation: '你好',
    summary: '问候',
    provider: 'openai-format' as const
  }

  it('uses provider and language in cache keys', () => {
    expect(createMokuroAnalysisCacheKey({
      provider: 'openai-format',
      language: 'zh',
      pageIndex: 2,
      blockIndex: 7
    })).toBe('openai-format:zh:2:7')
  })

  it('serializes and parses saved analysis cache files', () => {
    const key = createMokuroAnalysisCacheKey({
      provider: 'openai-format',
      language: 'zh',
      pageIndex: 0,
      blockIndex: 1
    })
    const content = serializeMokuroAnalysisCache({ [key]: result }, {
      title: 'spy6',
      pageCount: 208
    })

    const parsed = parseMokuroAnalysisCacheContent(content)

    expect(parsed.version).toBe(1)
    expect(parsed.source.title).toBe('spy6')
    expect(parsed.analyses[key]).toEqual(result)
  })
})

describe('clampPageRange', () => {
  it('returns null when from > to', () => {
    expect(clampPageRange(5, 3, 10)).toBeNull()
  })

  it('clamps to the page bounds', () => {
    expect(clampPageRange(0, 20, 10)).toEqual({ from: 1, to: 10 })
  })

  it('passes through a valid range unchanged', () => {
    expect(clampPageRange(3, 7, 10)).toEqual({ from: 3, to: 7 })
  })

  it('clamps start below 1 to 1', () => {
    expect(clampPageRange(-2, 4, 10)).toEqual({ from: 1, to: 4 })
  })
})
