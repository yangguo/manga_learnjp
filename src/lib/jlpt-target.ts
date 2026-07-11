import { JLPT_LEVELS } from './jlpt-levels'
import type { JLPTClassification, JLPTLevel } from './jlpt-levels'

export type JLPTVocabularyBand = 'foundation' | 'focus' | 'stretch' | 'unclassified'

export interface JLPTVocabularyGroups<T> {
  foundation: T[]
  focus: T[]
  stretch: T[]
  unclassified: T[]
}

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
