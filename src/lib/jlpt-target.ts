import { JLPT_LEVELS } from './jlpt-levels'
import type { GrammarJLPTClassification, JLPTClassification, JLPTLevel } from './jlpt-levels'

export type JLPTVocabularyBand = 'foundation' | 'focus' | 'stretch' | 'unclassified'

export interface JLPTVocabularyGroups<T> {
  foundation: T[]
  focus: T[]
  stretch: T[]
  unclassified: T[]
}

export type JLPTGrammarGroups<T> = JLPTVocabularyGroups<T>

export const classifyJLPTLevelForTarget = (
  level: JLPTLevel | null,
  target: JLPTLevel
): JLPTVocabularyBand => {
  if (level === null) return 'unclassified'

  const levelIndex = JLPT_LEVELS.indexOf(level)
  const targetIndex = JLPT_LEVELS.indexOf(target)
  if (levelIndex < targetIndex) return 'foundation'
  if (levelIndex === targetIndex) return 'focus'
  return 'stretch'
}

export const getJLPTLevelsForBand = (
  target: JLPTLevel,
  band: JLPTVocabularyBand
): JLPTLevel[] => {
  const targetIndex = JLPT_LEVELS.indexOf(target)
  if (band === 'foundation') return JLPT_LEVELS.slice(0, targetIndex)
  if (band === 'focus') return [target]
  if (band === 'stretch') return JLPT_LEVELS.slice(targetIndex + 1)
  return []
}

export const formatJLPTLevelRange = (levels: JLPTLevel[]): string => {
  if (levels.length === 0) return ''
  if (levels.length === 1) return levels[0]
  return `${levels[0]}–${levels[levels.length - 1]}`
}

export const groupVocabularyByTarget = <T extends { jlpt?: JLPTClassification }>(
  words: T[],
  target: JLPTLevel
): JLPTVocabularyGroups<T> => {
  const groups: JLPTVocabularyGroups<T> = {
    foundation: [],
    focus: [],
    stretch: [],
    unclassified: []
  }

  words.forEach(word => {
    const band = classifyJLPTLevelForTarget(word.jlpt?.level ?? null, target)
    groups[band].push(word)
  })

  return groups
}

export const groupGrammarByTarget = <T extends { jlpt?: GrammarJLPTClassification }>(
  grammar: T[],
  target: JLPTLevel
): JLPTGrammarGroups<T> => {
  const groups: JLPTGrammarGroups<T> = {
    foundation: [],
    focus: [],
    stretch: [],
    unclassified: []
  }

  grammar.forEach(pattern => {
    const band = classifyJLPTLevelForTarget(pattern.jlpt?.level ?? null, target)
    groups[band].push(pattern)
  })

  return groups
}
