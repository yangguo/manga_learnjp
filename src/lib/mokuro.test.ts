import { describe, expect, it } from 'vitest'
import {
  MOKURO_ANALYSIS_CACHE_FILENAME,
  clampPageRange,
  createMokuroAnalysisCacheKey,
  createMokuroImageLookup,
  filterAnalysesByPageIndex,
  findMokuroPageImageFile,
  getMokuroPageAnalysisConcurrency,
  getPersistableAnalysisRecord,
  isMokuroPageAnalysisComplete,
  shouldStopMokuroRangeAfterPageAnalysis,
  getPageCacheFilename,
  getMokuroBlockText,
  groupAnalysesByPageIndex,
  planMokuroDirectoryImport,
  parseMokuroAnalysisCacheContent,
  parseMokuroPageAnalysisCacheContent,
  serializeMokuroAnalysisCache,
  serializeMokuroPageAnalysisCache,
  parseMokuroFileContent
} from './mokuro'
import { JLPT_DATASET_VERSION } from './jlpt-levels'

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
    expect(plan.legacyCacheFile).toBe(cacheFile)
    expect(plan.cachePageFiles).toEqual([])
  })

  it('detects per-page cache files in the mokuro-analysis-cache directory', () => {
    const mokuroFile = { name: 'spy6.mokuro', webkitRelativePath: 'spy6-output/spy6.mokuro' }
    const pageCacheFile = { name: 'page-001.json', webkitRelativePath: 'spy6-output/mokuro-analysis-cache/page-001.json' }
    const decoyFile = { name: 'page-002.json', webkitRelativePath: 'spy6-output/spy6/page-002.json' }

    const plan = planMokuroDirectoryImport([decoyFile, pageCacheFile, mokuroFile])

    expect(plan.cachePageFiles).toEqual([pageCacheFile])
    expect(plan.legacyCacheFile).toBeNull()
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
    provider: 'openai-format' as const,
    jlptCalibration: {
      status: 'ready' as const,
      datasetVersion: JLPT_DATASET_VERSION,
      persistable: true
    }
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

    expect(parsed.version).toBe(2)
    expect(parsed.jlptDatasetVersion).toBe(JLPT_DATASET_VERSION)
    expect(parsed.source.title).toBe('spy6')
    expect(parsed.analyses[key]).toEqual(result)
  })

  it('reads v1 caches but always serializes v2 with the JLPT dataset version', () => {
    const v1 = JSON.stringify({
      version: 1,
      savedAt: '2026-07-10T00:00:00.000Z',
      source: {},
      analyses: {}
    })
    expect(parseMokuroAnalysisCacheContent(v1).version).toBe(1)
    const v2 = JSON.parse(serializeMokuroAnalysisCache({}))
    expect(v2.version).toBe(2)
    expect(v2.jlptDatasetVersion).toBe(JLPT_DATASET_VERSION)
  })

  it('writes only persistable calibrated analyses', () => {
    const ready = { ...result }
    const error = {
      ...result,
      jlptCalibration: {
        status: 'error' as const,
        datasetVersion: JLPT_DATASET_VERSION,
        persistable: false
      }
    }
    expect(Object.keys(getPersistableAnalysisRecord({ ready, error }))).toEqual(['ready'])
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

describe('getPageCacheFilename', () => {
  it('zero-pads to the page count width (min 3)', () => {
    expect(getPageCacheFilename(0, 220)).toBe('page-001.json')
    expect(getPageCacheFilename(219, 220)).toBe('page-220.json')
  })

  it('uses at least 3 digits even for small volumes', () => {
    expect(getPageCacheFilename(0, 5)).toBe('page-001.json')
  })

  it('widens for 1000+ pages', () => {
    expect(getPageCacheFilename(999, 1000)).toBe('page-1000.json')
  })
})

describe('serializeMokuroPageAnalysisCache / parseMokuroPageAnalysisCacheContent', () => {
  const key = createMokuroAnalysisCacheKey({ provider: 'openai-format', language: 'zh', pageIndex: 2, blockIndex: 0 })
  const analyses = {
    [key]: {
      extractedText: 'こんにちは',
      sentences: [],
      translation: 'Hello',
      summary: 'greeting',
      provider: 'openai-format',
      jlptCalibration: {
        status: 'ready' as const,
        datasetVersion: JLPT_DATASET_VERSION,
        persistable: true
      }
    }
  }

  it('round-trips a page cache file', () => {
    const content = serializeMokuroPageAnalysisCache(2, analyses)
    const parsed = parseMokuroPageAnalysisCacheContent(content)
    expect(parsed.pageIndex).toBe(2)
    expect(parsed.version).toBe(2)
    expect(parsed.jlptDatasetVersion).toBe(JLPT_DATASET_VERSION)
    expect(parsed.analyses[key]).toEqual(analyses[key])
  })

  it('reads v1 page caches but serializes v2', () => {
    const v1 = JSON.stringify({ version: 1, savedAt: '2026-07-10T00:00:00.000Z', pageIndex: 2, analyses: {} })
    expect(parseMokuroPageAnalysisCacheContent(v1).version).toBe(1)
    const v2 = JSON.parse(serializeMokuroPageAnalysisCache(2, {}))
    expect(v2.version).toBe(2)
    expect(v2.jlptDatasetVersion).toBe(JLPT_DATASET_VERSION)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseMokuroPageAnalysisCacheContent('{not json')).toThrow('valid JSON')
  })
})

describe('groupAnalysesByPageIndex / filterAnalysesByPageIndex', () => {
  const page0 = createMokuroAnalysisCacheKey({ provider: 'openai-format', language: 'zh', pageIndex: 0, blockIndex: 0 })
  const page1 = createMokuroAnalysisCacheKey({ provider: 'openai-format', language: 'zh', pageIndex: 1, blockIndex: 0 })
  const analyses = {
    [page0]: { extractedText: 'a', sentences: [], translation: 'a', summary: 'a', provider: 'openai-format' },
    [page1]: { extractedText: 'b', sentences: [], translation: 'b', summary: 'b', provider: 'openai-format' }
  }

  it('groups entries by page index', () => {
    const groups = groupAnalysesByPageIndex(analyses)
    expect(groups.size).toBe(2)
    expect(groups.get(0)).toHaveProperty(page0)
    expect(groups.get(1)).toHaveProperty(page1)
  })

  it('filters to a single page', () => {
    const filtered = filterAnalysesByPageIndex(analyses, 1)
    expect(Object.keys(filtered)).toEqual([page1])
  })
})

describe('getMokuroPageAnalysisConcurrency', () => {
  it('uses the pending sentence count up to the cap', () => {
    expect(getMokuroPageAnalysisConcurrency(1)).toBe(1)
    expect(getMokuroPageAnalysisConcurrency(4)).toBe(4)
  })

  it('caps concurrency to avoid overwhelming the provider', () => {
    expect(getMokuroPageAnalysisConcurrency(8)).toBe(4)
    expect(getMokuroPageAnalysisConcurrency(30)).toBe(4)
  })

  it('returns zero when the page has no pending sentences', () => {
    expect(getMokuroPageAnalysisConcurrency(0)).toBe(0)
  })

  it('treats non-finite or negative input as zero', () => {
    expect(getMokuroPageAnalysisConcurrency(Number.NaN)).toBe(0)
    expect(getMokuroPageAnalysisConcurrency(-3)).toBe(0)
  })
})

describe('isMokuroPageAnalysisComplete', () => {
  it('treats cached and newly completed blocks as a complete page', () => {
    expect(isMokuroPageAnalysisComplete({
      total: 5,
      completed: 3,
      skipped: 2,
      failed: 0,
      cancelled: false
    })).toBe(true)
  })

  it('treats any failed block as an incomplete page', () => {
    expect(isMokuroPageAnalysisComplete({
      total: 5,
      completed: 3,
      skipped: 1,
      failed: 1,
      cancelled: false
    })).toBe(false)
  })

  it('treats cancelled pages as incomplete even if counts add up', () => {
    expect(isMokuroPageAnalysisComplete({
      total: 5,
      completed: 3,
      skipped: 2,
      failed: 0,
      cancelled: true
    })).toBe(false)
  })
})

describe('shouldStopMokuroRangeAfterPageAnalysis', () => {
  it('continues after a page with failed blocks', () => {
    expect(shouldStopMokuroRangeAfterPageAnalysis({
      cancelled: false,
      complete: false
    })).toBe(false)
  })

  it('stops only when the user cancelled the batch', () => {
    expect(shouldStopMokuroRangeAfterPageAnalysis({
      cancelled: true,
      complete: false
    })).toBe(true)
  })
})
