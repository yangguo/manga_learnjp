import type { AIProvider, AnalysisLanguage, AnalysisResult, MokuroAnalysisCacheFile, MokuroBlock, MokuroFile, MokuroPage } from './types'

export interface MokuroImageCandidate {
  name: string
  webkitRelativePath?: string
}

export interface MokuroDirectoryImportPlan<T extends MokuroImageCandidate> {
  mokuroFile: T
  imageFiles: T[]
  cachePageFiles: T[]
  legacyCacheFile: T | null
}

export interface MokuroAnalysisCacheKeyInput {
  provider: AIProvider
  language: AnalysisLanguage
  pageIndex: number
  blockIndex: number
}

export const MOKURO_ANALYSIS_CACHE_FILENAME = 'mokuro-analysis-cache.json'
export const MOKURO_ANALYSIS_CACHE_DIRNAME = 'mokuro-analysis-cache'

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value)
}

const isBox = (value: unknown): value is [number, number, number, number] => {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber)
}

const parseMokuroBlock = (value: unknown, pageNumber: number, blockNumber: number): MokuroBlock => {
  if (!isRecord(value)) {
    throw new Error(`Mokuro invalid page ${pageNumber}: block ${blockNumber} must be an object`)
  }

  if (!isBox(value.box)) {
    throw new Error(`Mokuro invalid page ${pageNumber}: block ${blockNumber} has an invalid box`)
  }

  if (!Array.isArray(value.lines) || !value.lines.every(line => typeof line === 'string')) {
    throw new Error(`Mokuro invalid page ${pageNumber}: block ${blockNumber} has invalid lines`)
  }

  return {
    box: value.box,
    vertical: value.vertical === true,
    font_size: isFiniteNumber(value.font_size) ? value.font_size : 16,
    lines: value.lines,
    lines_coords: value.lines_coords
  }
}

const parseMokuroPage = (value: unknown, index: number): MokuroPage => {
  const pageNumber = index + 1

  if (!isRecord(value)) {
    throw new Error(`Mokuro invalid page ${pageNumber}: page must be an object`)
  }

  if (!isFiniteNumber(value.img_width) || value.img_width <= 0) {
    throw new Error(`Mokuro invalid page ${pageNumber}: img_width must be a positive number`)
  }

  if (!isFiniteNumber(value.img_height) || value.img_height <= 0) {
    throw new Error(`Mokuro invalid page ${pageNumber}: img_height must be a positive number`)
  }

  if (typeof value.img_path !== 'string' || value.img_path.trim().length === 0) {
    throw new Error(`Mokuro invalid page ${pageNumber}: img_path is required`)
  }

  if (!Array.isArray(value.blocks)) {
    throw new Error(`Mokuro invalid page ${pageNumber}: blocks must be an array`)
  }

  return {
    version: typeof value.version === 'string' ? value.version : undefined,
    img_width: value.img_width,
    img_height: value.img_height,
    img_path: value.img_path,
    blocks: value.blocks.map((block, blockIndex) => parseMokuroBlock(block, pageNumber, blockIndex + 1))
  }
}

export const parseMokuroFileContent = (content: string): MokuroFile => {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('Mokuro file must contain valid JSON')
  }

  if (!isRecord(parsed)) {
    throw new Error('Mokuro file root must be an object')
  }

  if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
    throw new Error('Mokuro file must contain at least one page')
  }

  return {
    version: typeof parsed.version === 'string' ? parsed.version : undefined,
    title: typeof parsed.title === 'string' ? parsed.title : undefined,
    title_uuid: typeof parsed.title_uuid === 'string' ? parsed.title_uuid : undefined,
    volume: typeof parsed.volume === 'string' ? parsed.volume : undefined,
    volume_uuid: typeof parsed.volume_uuid === 'string' ? parsed.volume_uuid : undefined,
    pages: parsed.pages.map(parseMokuroPage)
  }
}

export const getMokuroBlockText = (block: MokuroBlock): string => {
  return block.lines
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
}

const isImageFileName = (name: string): boolean => /\.(png|jpe?g|webp|bmp)$/i.test(name)

const isMokuroFileName = (name: string): boolean => /\.mokuro$/i.test(name)

const normalizeImagePath = (path: string): string => {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .toLowerCase()
}

const basename = (path: string): string => {
  const normalized = normalizeImagePath(path)
  const parts = normalized.split('/')
  return parts[parts.length - 1]
}

export const createMokuroImageLookup = <T extends MokuroImageCandidate>(files: T[]): Map<string, T> => {
  const lookup = new Map<string, T>()

  files.forEach(file => {
    lookup.set(normalizeImagePath(file.name), file)
    lookup.set(basename(file.name), file)

    if (file.webkitRelativePath) {
      lookup.set(normalizeImagePath(file.webkitRelativePath), file)
      lookup.set(basename(file.webkitRelativePath), file)
    }
  })

  return lookup
}

export const findMokuroPageImageFile = <T extends MokuroImageCandidate>(
  page: Pick<MokuroPage, 'img_path'>,
  lookup: Map<string, T>
): T | null => {
  return lookup.get(normalizeImagePath(page.img_path)) ?? lookup.get(basename(page.img_path)) ?? null
}

export const planMokuroDirectoryImport = <T extends MokuroImageCandidate>(
  files: T[]
): MokuroDirectoryImportPlan<T> => {
  const mokuroFiles = files.filter(file => isMokuroFileName(file.name))
  if (mokuroFiles.length === 0) {
    throw new Error('No .mokuro file found in the selected directory')
  }

  const sortedMokuroFiles = [...mokuroFiles].sort((a, b) => {
    const aPath = a.webkitRelativePath ?? a.name
    const bPath = b.webkitRelativePath ?? b.name
    return aPath.localeCompare(bPath)
  })

  const isPageCacheFile = (file: T): boolean => {
    const path = (file.webkitRelativePath ?? file.name).replace(/\\/g, '/')
    return /(^|\/)mokuro-analysis-cache\/page-\d+\.json$/.test(path)
  }

  return {
    mokuroFile: sortedMokuroFiles[0],
    imageFiles: files.filter(file => isImageFileName(file.name)),
    cachePageFiles: files.filter(isPageCacheFile),
    legacyCacheFile: files.find(file => file.name === MOKURO_ANALYSIS_CACHE_FILENAME) ?? null
  }
}

export const createMokuroAnalysisCacheKey = ({
  provider,
  language,
  pageIndex,
  blockIndex
}: MokuroAnalysisCacheKeyInput): string => {
  return `${provider}:${language}:${pageIndex}:${blockIndex}`
}

const isAnalysisResult = (value: unknown): value is AnalysisResult => {
  if (!isRecord(value)) return false
  return (
    typeof value.extractedText === 'string' &&
    Array.isArray(value.sentences) &&
    typeof value.translation === 'string' &&
    typeof value.summary === 'string' &&
    (value.provider === 'openai' || value.provider === 'openai-format')
  )
}

export const parseMokuroAnalysisCacheContent = (content: string): MokuroAnalysisCacheFile => {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('Mokuro analysis cache must contain valid JSON')
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.analyses)) {
    throw new Error('Mokuro analysis cache has an invalid format')
  }

  const analyses: Record<string, AnalysisResult> = {}
  Object.entries(parsed.analyses).forEach(([key, value]) => {
    if (isAnalysisResult(value)) {
      analyses[key] = value
    }
  })

  const source = isRecord(parsed.source) ? parsed.source : {}

  return {
    version: 1,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date(0).toISOString(),
    source: {
      title: typeof source.title === 'string' ? source.title : undefined,
      pageCount: isFiniteNumber(source.pageCount) ? source.pageCount : undefined
    },
    analyses
  }
}

export const serializeMokuroAnalysisCache = (
  analyses: Record<string, AnalysisResult>,
  source: MokuroAnalysisCacheFile['source'] = {}
): string => {
  const cacheFile: MokuroAnalysisCacheFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    source,
    analyses
  }

  return `${JSON.stringify(cacheFile, null, 2)}\n`
}

export interface PageRange {
  from: number
  to: number
}

// Validate and clamp a 1-based inclusive page range. Returns null when the
// range is empty (from > to) or the document has no pages.
export const clampPageRange = (from: number, to: number, pageCount: number): PageRange | null => {
  if (!Number.isFinite(from) || !Number.isFinite(to) || pageCount <= 0) return null
  if (from > to) return null

  const clampedFrom = Math.min(Math.max(Math.floor(from), 1), pageCount)
  const clampedTo = Math.min(Math.max(Math.floor(to), 1), pageCount)

  if (clampedFrom > clampedTo) return null
  return { from: clampedFrom, to: clampedTo }
}

// 1-based, zero-padded to the page count's digit width (min 3).
export const getPageCacheFilename = (pageIndex: number, pageCount: number): string => {
  const width = Math.max(3, String(pageCount).length)
  return `page-${String(pageIndex + 1).padStart(width, '0')}.json`
}

export const serializeMokuroPageAnalysisCache = (
  pageIndex: number,
  analyses: Record<string, AnalysisResult>
): string => {
  const file = {
    version: 1 as const,
    savedAt: new Date().toISOString(),
    pageIndex,
    analyses
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

export interface ParsedMokuroPageAnalysisCache {
  pageIndex: number
  analyses: Record<string, AnalysisResult>
}

export const parseMokuroPageAnalysisCacheContent = (content: string): ParsedMokuroPageAnalysisCache => {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('Mokuro page analysis cache must contain valid JSON')
  }

  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.analyses)) {
    throw new Error('Mokuro page analysis cache has an invalid format')
  }

  const analyses: Record<string, AnalysisResult> = {}
  Object.entries(parsed.analyses).forEach(([key, value]) => {
    if (isAnalysisResult(value)) {
      analyses[key] = value
    }
  })

  return {
    pageIndex: isFiniteNumber(parsed.pageIndex) ? parsed.pageIndex : -1,
    analyses
  }
}

const pageIndexFromCacheKey = (key: string): number | null => {
  const parts = key.split(':')
  const pageIndex = Number(parts[2])
  return Number.isFinite(pageIndex) ? pageIndex : null
}

export const groupAnalysesByPageIndex = (
  analyses: Record<string, AnalysisResult>
): Map<number, Record<string, AnalysisResult>> => {
  const groups = new Map<number, Record<string, AnalysisResult>>()
  for (const [key, value] of Object.entries(analyses)) {
    const pageIndex = pageIndexFromCacheKey(key)
    if (pageIndex === null) continue
    const group = groups.get(pageIndex) ?? {}
    group[key] = value
    groups.set(pageIndex, group)
  }
  return groups
}

export const filterAnalysesByPageIndex = (
  analyses: Record<string, AnalysisResult>,
  pageIndex: number
): Record<string, AnalysisResult> => {
  const result: Record<string, AnalysisResult> = {}
  for (const [key, value] of Object.entries(analyses)) {
    if (pageIndexFromCacheKey(key) === pageIndex) {
      result[key] = value
    }
  }
  return result
}

// Cap concurrent per-page block analyses so a page with many blocks does not
// fire dozens of simultaneous requests at the AI provider (rate limits, local
// Ollama overload, retry thundering-herd). Sequential was the original spec; 4
// is a deliberate, bounded relaxation.
export const MAX_MOKURO_PAGE_ANALYSIS_CONCURRENCY = 4

export const getMokuroPageAnalysisConcurrency = (pendingSentenceCount: number): number => {
  const count = Math.max(0, Math.floor(Number.isFinite(pendingSentenceCount) ? pendingSentenceCount : 0))
  return Math.min(count, MAX_MOKURO_PAGE_ANALYSIS_CONCURRENCY)
}

interface MokuroPageAnalysisCompletionState {
  total: number
  completed: number
  skipped: number
  failed: number
  cancelled: boolean
}

export const isMokuroPageAnalysisComplete = ({
  total,
  completed,
  skipped,
  failed,
  cancelled
}: MokuroPageAnalysisCompletionState): boolean => {
  if (cancelled || failed > 0) {
    return false
  }

  return completed + skipped >= total
}

interface MokuroRangeContinuationState {
  cancelled: boolean
  complete: boolean
}

export const shouldStopMokuroRangeAfterPageAnalysis = ({
  cancelled
}: MokuroRangeContinuationState): boolean => {
  return cancelled
}
