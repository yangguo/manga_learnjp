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
