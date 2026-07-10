import type { SavedWord, WordAnalysis } from './types'
import type { JLPTDictionary } from './jlpt-dictionary'

export const savedWordKey = (word: string, reading: string): string =>
  JSON.stringify([word, reading])

export const toSavedWord = (
  word: WordAnalysis,
  sourceSentence: string | null,
  savedAt: string,
  persistJLPT = false
): SavedWord => ({
  word: word.word,
  reading: word.reading,
  meaning: word.meaning,
  partOfSpeech: word.partOfSpeech,
  ...(persistJLPT && word.jlpt ? { jlpt: word.jlpt } : {}),
  sourceSentence,
  savedAt
})

export const reclassifySavedWords = (
  words: SavedWord[],
  dictionary: JLPTDictionary
): SavedWord[] => words.map(word => ({
  ...word,
  jlpt: dictionary.classify(word.word, word.reading)
}))

export const addWord = (words: SavedWord[], entry: SavedWord): SavedWord[] => {
  const key = savedWordKey(entry.word, entry.reading)
  if (words.some(w => savedWordKey(w.word, w.reading) === key)) {
    return words
  }
  return [entry, ...words]
}

export const removeWord = (
  words: SavedWord[],
  word: string,
  reading: string
): SavedWord[] => {
  const key = savedWordKey(word, reading)
  return words.filter(w => savedWordKey(w.word, w.reading) !== key)
}

export const toggleWord = (words: SavedWord[], entry: SavedWord): SavedWord[] => {
  const key = savedWordKey(entry.word, entry.reading)
  if (words.some(w => savedWordKey(w.word, w.reading) === key)) {
    return removeWord(words, entry.word, entry.reading)
  }
  return addWord(words, entry)
}

export const isSaved = (
  words: SavedWord[],
  word: string,
  reading: string
): boolean => {
  const key = savedWordKey(word, reading)
  return words.some(w => savedWordKey(w.word, w.reading) === key)
}
