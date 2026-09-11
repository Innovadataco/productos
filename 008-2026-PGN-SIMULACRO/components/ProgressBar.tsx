'use client'

interface Props {
  current: number
  total: number
}

export default function ProgressBar({ current, total }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-500">
        <span>
          {current}/{total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: '#0b6e5a' }}
        />
      </div>
    </div>
  )
}
