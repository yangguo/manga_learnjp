import type { SavedWord } from './types'

const ANKI_HEADERS = [
  '#separator:Tab',
  '#html:false',
  '#tags column:8',
  '#columns:Word\tReading\tMeaning\tPartOfSpeech\tJLPT\tSourceSentence\tSavedAt\tTags'
]

export const sanitizeAnkiField = (value: string | null | undefined): string => {
  return value?.replace(/[\t\r\n]+/g, ' ') ?? ''
}

export const getAnkiTags = (word: SavedWord): string => {
  return `manga_learnjp jlpt::${word.jlpt?.level ?? 'unclassified'}`
}

export const serializeWordsForAnki = (words: SavedWord[]): string => {
  const rows = words.map(word => [
    word.word,
    word.reading,
    word.meaning,
    word.partOfSpeech,
    word.jlpt?.level,
    word.sourceSentence,
    word.savedAt,
    getAnkiTags(word)
  ].map(sanitizeAnkiField).join('\t'))

  return `${[...ANKI_HEADERS, ...rows].join('\n')}\n`
}

export const createAnkiExportFilename = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `manga-learnjp-words-${year}-${month}-${day}.tsv`
}

interface DownloadLink {
  href: string
  download: string
  click: () => void
  remove: () => void
}

interface DownloadEnvironment {
  createBlob: (parts: BlobPart[], options: BlobPropertyBag) => Blob
  createObjectURL: (blob: Blob) => string
  revokeObjectURL: (url: string) => void
  createLink: () => DownloadLink
  appendLink: (link: DownloadLink) => void
}

const getBrowserDownloadEnvironment = (): DownloadEnvironment => ({
  createBlob: (parts, options) => new Blob(parts, options),
  createObjectURL: blob => URL.createObjectURL(blob),
  revokeObjectURL: url => URL.revokeObjectURL(url),
  createLink: () => document.createElement('a'),
  appendLink: link => document.body.append(link)
})

export const downloadTextFile = (
  content: string,
  filename: string,
  environment = getBrowserDownloadEnvironment()
): void => {
  const blob = environment.createBlob([content], {
    type: 'text/tab-separated-values;charset=utf-8'
  })
  const url = environment.createObjectURL(blob)
  let link: DownloadLink | null = null

  try {
    link = environment.createLink()
    link.href = url
    link.download = filename
    environment.appendLink(link)
    link.click()
  } finally {
    link?.remove()
    environment.revokeObjectURL(url)
  }
}
