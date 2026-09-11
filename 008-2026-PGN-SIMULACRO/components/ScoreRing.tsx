'use client'

interface Props {
  percent: number
}

function colorFor(percent: number): string {
  if (percent >= 80) return '#16a34a'
  if (percent >= 60) return '#d97706'
  return '#dc2626'
}

export default function ScoreRing({ percent }: Props) {
  const color = colorFor(percent)
  const r = 52
  const c = 2 * Math.PI * r
  const filled = (Math.min(percent, 100) / 100) * c
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f3f4f6" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold" style={{ color }}>
          {percent}%
        </span>
      </div>
    </div>
  )
}
