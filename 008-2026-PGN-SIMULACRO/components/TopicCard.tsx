'use client'

import Link from 'next/link'
import { TopicConfig, TopicStats } from '@/lib/types'

interface Props {
  topic: TopicConfig
  count: number
  stats: TopicStats
}

export default function TopicCard({ topic, count, stats }: Props) {
  const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
  const barPct = stats.total > 0 ? Math.round((stats.total / Math.max(count, 1)) * 100) : 0
  return (
    <Link
      href={`/modulo/${encodeURIComponent(topic.key)}/`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>{topic.icon}</span>
          <div>
            <p className="font-semibold text-gray-900">{topic.name}</p>
            <p className="text-xs text-gray-500">
              {count} preguntas · {topic.hours} de estudio
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
          style={{ backgroundColor: topic.color }}
        >
          {stats.total > 0 ? `${pct}%` : '—'}
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(barPct, 100)}%`, backgroundColor: topic.color }}
        />
      </div>
    </Link>
  )
}
