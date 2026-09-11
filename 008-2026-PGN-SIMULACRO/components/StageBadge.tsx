'use client'

import { StageKey, StageStats } from '@/lib/types'

interface Props {
  stage: StageKey
  stats: StageStats
}

export default function StageBadge({ stage, stats }: Props) {
  if (stage === 'resumen') {
    return stats.resumen_done ? <Check color="#4f46e5" /> : <Pending />
  }
  if (stage === 'flashcards') {
    if (!stats.flashcards_done) return <Pending />
    if (stats.flashcards_score >= 100) return <Check color="#d97706" />
    return <span className="text-xs font-bold" style={{ color: '#d97706' }}>{stats.flashcards_score}%</span>
  }
  if (stage === 'quiz') {
    if (stats.quiz_total === 0) return <Pending />
    const pct = Math.round((stats.quiz_correct / stats.quiz_total) * 100)
    return <span className="text-xs font-bold" style={{ color: '#0b6e5a' }}>{pct}%</span>
  }
  // resultado
  return stats.resultado_seen ? <Check color="#059669" /> : <Pending />
}

function Check({ color }: { color: string }) {
  return (
    <span className="rounded-full px-1.5 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: color }}>
      ✓
    </span>
  )
}

function Pending() {
  return (
    <span className="rounded-full border border-gray-200 px-1.5 py-0.5 text-xs font-bold text-gray-300">○</span>
  )
}
