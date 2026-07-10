import { describe, expect, it } from 'vitest'
import {
  createMokuroProgressKey,
  DEFAULT_MOKURO_PROGRESS,
  restoreMokuroProgress,
  serializeMokuroProgress
} from './mokuro-progress'
import type { MokuroFile } from './types'

const mokuro: MokuroFile = {
  title_uuid: 'title-uuid',
  volume_uuid: 'volume-uuid',
  pages: [
    {
      img_width: 100,
      img_height: 100,
      img_path: '001.jpg',
      blocks: [
        { box: [0, 0, 10, 10], vertical: false, font_size: 10, lines: ['一'] },
        { box: [10, 0, 10, 10], vertical: false, font_size: 10, lines: ['二'] }
      ]
    },
    {
      img_width: 100,
      img_height: 100,
      img_path: '002.jpg',
      blocks: [
        { box: [0, 0, 10, 10], vertical: false, font_size: 10, lines: ['三'] }
      ]
    }
  ]
}

describe('createMokuroProgressKey', () => {
  it('uses stable Mokuro UUIDs when they are available', () => {
    expect(createMokuroProgressKey({
      mokuro,
      mokuroName: 'book.mokuro',
      directoryName: 'book'
    })).toContain('title-uuid')
  })

  it('uses deterministic directory, file, and page-count fallback without UUIDs', () => {
    const withoutUUIDs = { ...mokuro, title_uuid: undefined, volume_uuid: undefined }
    expect(createMokuroProgressKey({
      mokuro: withoutUUIDs,
      mokuroName: 'book.mokuro',
      directoryName: 'book'
    })).toBe(createMokuroProgressKey({
      mokuro: withoutUUIDs,
      mokuroName: 'book.mokuro',
      directoryName: 'book'
    }))
  })
})

describe('restoreMokuroProgress', () => {
  it('round-trips a valid saved page and selected block', () => {
    const saved = serializeMokuroProgress({ pageIndex: 1, selectedBlockIndex: 0 }, '2026-07-11T00:00:00.000Z')
    expect(restoreMokuroProgress(saved, mokuro)).toEqual({ pageIndex: 1, selectedBlockIndex: 0 })
  })

  it('falls back to the first page for malformed or invalid records', () => {
    expect(restoreMokuroProgress('{bad json', mokuro)).toEqual(DEFAULT_MOKURO_PROGRESS)
    expect(restoreMokuroProgress(JSON.stringify({ schemaVersion: 2, pageIndex: 1, selectedBlockIndex: 0 }), mokuro))
      .toEqual(DEFAULT_MOKURO_PROGRESS)
    expect(restoreMokuroProgress(JSON.stringify({ schemaVersion: 1, pageIndex: 2, selectedBlockIndex: 0 }), mokuro))
      .toEqual(DEFAULT_MOKURO_PROGRESS)
    expect(restoreMokuroProgress(JSON.stringify({ schemaVersion: 1, pageIndex: 0.5, selectedBlockIndex: null }), mokuro))
      .toEqual(DEFAULT_MOKURO_PROGRESS)
  })

  it('keeps a valid page but clears a block that no longer exists', () => {
    const saved = JSON.stringify({ schemaVersion: 1, pageIndex: 1, selectedBlockIndex: 1, savedAt: '2026-07-11T00:00:00.000Z' })
    expect(restoreMokuroProgress(saved, mokuro)).toEqual({ pageIndex: 1, selectedBlockIndex: null })
  })
})
