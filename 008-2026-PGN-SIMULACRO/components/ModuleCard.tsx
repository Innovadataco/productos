'use client'

import Link from 'next/link'
import { StageKey, StageStats, STAGE_COLORS, STAGE_LABELS } from '@/lib/types'

interface Props {
  stage: StageKey
  stats: StageStats
  href: string
  disabled?: boolean
}

export default function ModuleCard({ stage, stats, href, disabled }: Props) {
  const color = STAGE_COLORS[stage]
  const { title, subtitle, icon } = STAGE_LABELS[stage]

  const content = (
    <div
      className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition-shadow ${disabled ? 'opacity-60' : 'hover:shadow-md'}`}
      style={{ borderColor: color }}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: `${color}15` }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <StateLabel stage={stage} stats={stats} color={color} />
      </div>
    </div>
  )

  if (disabled) return content
  return <Link href={href} className="block">{content}</Link>
}

function stageState(stage: StageKey, stats: StageStats): 'pending' | 'done' | 'score' {
  if (stage === 'resumen') return stats.resumen_done ? 'done' : 'pending'
  if (stage === 'flashcards') return stats.flashcards_done ? 'done' : 'pending'
  if (stage === 'quiz') return stats.quiz_total > 0 ? 'score' : 'pending'
  return stats.resultado_seen ? 'done' : 'pending'
}

function StateLabel({ stage, stats, color }: { stage: StageKey; stats: StageStats; color: string }) {
  const state = stageState(stage, stats)
  if (state === 'done') {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: color }}>
        ✓
      </span>
    )
  }
  if (state === 'score') {
    const pct = Math.round((stats.quiz_correct / stats.quiz_total) * 100)
    return (
      <span className="text-sm font-extrabold" style={{ color }}>
        {pct}%
      </span>
    )
  }
  return <span className="text-xs font-medium text-gray-400">Pendiente</span>
}
