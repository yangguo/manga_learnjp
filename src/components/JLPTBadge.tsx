import type { AnalysisLanguage } from '@/lib/types'
import type { JLPTClassification, JLPTLevel } from '@/lib/jlpt-levels'

const CLASSES: Record<JLPTLevel, string> = {
  N5: 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300',
  N4: 'border-lime-500/25 bg-lime-500/15 text-lime-300',
  N3: 'border-amber-500/25 bg-amber-500/15 text-amber-300',
  N2: 'border-orange-500/25 bg-orange-500/15 text-orange-300',
  N1: 'border-red-500/25 bg-red-500/15 text-red-300'
}

export default function JLPTBadge({
  classification,
  language = 'zh'
}: {
  classification?: JLPTClassification
  language?: AnalysisLanguage
}) {
  const level = classification?.level ?? null
  const label = level ?? (language === 'zh' ? '未定级' : 'Unclassified')
  const title = classification
    ? `${classification.source} / ${classification.datasetVersion} / ${classification.match}`
    : (language === 'zh' ? '尚未校准' : 'Not calibrated')

  return (
    <span
      title={title}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
        level ? CLASSES[level] : 'border-gray-500/25 bg-gray-500/15 text-gray-300'
      }`}
    >
      {label}
    </span>
  )
}
