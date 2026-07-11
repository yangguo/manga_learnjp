'use client'

import { JLPT_LEVELS } from '@/lib/jlpt-levels'
import { useJLPTTargetStore } from '@/lib/jlpt-target-store'
import type { AnalysisLanguage } from '@/lib/types'

export default function JLPTTargetSelector({ language }: { language: AnalysisLanguage }) {
  const targetLevel = useJLPTTargetStore(state => state.targetLevel)
  const setTargetLevel = useJLPTTargetStore(state => state.setTargetLevel)
  const label = language === 'zh' ? '目标等级' : 'Target level'

  return (
    <div
      role="group"
      aria-label={label}
      className="mb-3 flex flex-wrap items-center gap-2 border-b border-white/10 pb-3"
    >
      <span className="mr-1 text-xs text-gray-400">{label}</span>
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-white/10 bg-gray-950/60 p-1">
        {JLPT_LEVELS.map(level => {
          const selected = level === targetLevel
          return (
            <button
              key={level}
              type="button"
              aria-pressed={selected}
              onClick={() => setTargetLevel(level)}
              className={`h-7 min-w-10 rounded-md px-2 text-xs font-semibold transition-colors ${
                selected
                  ? 'bg-white text-gray-950'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {level}
            </button>
          )
        })}
      </div>
    </div>
  )
}
