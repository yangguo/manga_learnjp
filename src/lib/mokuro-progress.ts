import type { MokuroFile } from './types'

export const MOKURO_PROGRESS_STORAGE_PREFIX = 'manga-learnjp:mokuro-progress:'

export interface MokuroReadingProgress {
  pageIndex: number
  selectedBlockIndex: number | null
}

interface StoredMokuroReadingProgress extends MokuroReadingProgress {
  schemaVersion: 1
  savedAt: string
}

export const DEFAULT_MOKURO_PROGRESS: MokuroReadingProgress = {
  pageIndex: 0,
  selectedBlockIndex: null
}

interface MokuroProgressIdentityInput {
  mokuro: MokuroFile
  mokuroName: string | null
  directoryName: string | null
}

const isNonNegativeInteger = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

const isStoredProgress = (value: unknown): value is StoredMokuroReadingProgress => {
  if (!value || typeof value !== 'object') return false
  const progress = value as Record<string, unknown>
  return progress.schemaVersion === 1 &&
    isNonNegativeInteger(progress.pageIndex) &&
    (progress.selectedBlockIndex === null || isNonNegativeInteger(progress.selectedBlockIndex)) &&
    typeof progress.savedAt === 'string'
}

export const createMokuroProgressKey = ({
  mokuro,
  mokuroName,
  directoryName
}: MokuroProgressIdentityInput): string => {
  const identity = mokuro.title_uuid || mokuro.volume_uuid
    ? ['uuid', mokuro.title_uuid ?? null, mokuro.volume_uuid ?? null]
    : ['fallback', directoryName ?? 'unknown-directory', mokuroName ?? 'unknown-file', mokuro.pages.length]

  return `${MOKURO_PROGRESS_STORAGE_PREFIX}${encodeURIComponent(JSON.stringify(identity))}`
}

export const serializeMokuroProgress = (
  progress: MokuroReadingProgress,
  savedAt = new Date().toISOString()
): string => {
  return JSON.stringify({
    schemaVersion: 1,
    pageIndex: progress.pageIndex,
    selectedBlockIndex: progress.selectedBlockIndex,
    savedAt
  } satisfies StoredMokuroReadingProgress)
}

export const restoreMokuroProgress = (
  serialized: string | null,
  mokuro: MokuroFile
): MokuroReadingProgress => {
  if (!serialized) return { ...DEFAULT_MOKURO_PROGRESS }

  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!isStoredProgress(parsed) || parsed.pageIndex >= mokuro.pages.length) {
      return { ...DEFAULT_MOKURO_PROGRESS }
    }

    const page = mokuro.pages[parsed.pageIndex]
    const selectedBlockIndex = parsed.selectedBlockIndex !== null && parsed.selectedBlockIndex < page.blocks.length
      ? parsed.selectedBlockIndex
      : null

    return { pageIndex: parsed.pageIndex, selectedBlockIndex }
  } catch {
    return { ...DEFAULT_MOKURO_PROGRESS }
  }
}
