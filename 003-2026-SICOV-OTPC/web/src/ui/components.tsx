import type { ReactNode } from 'react'
import type { EstadoCola } from '@/data/demo'

export function PageHeader({ eyebrow, title, desc, actions }: { eyebrow?: string; title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="row between wrap gap-16" style={{ marginBottom: 22, alignItems: 'flex-end' }}>
      <div className="col gap-6">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="h1">{title}</h1>
        {desc && <span className="muted" style={{ fontSize: 14 }}>{desc}</span>}
      </div>
      {actions && <div className="row gap-10 wrap">{actions}</div>}
    </div>
  )
}

const colaMap: Record<EstadoCola, { cls: string; txt: string }> = {
  pendiente: { cls: 'badge-neutral', txt: 'Pendiente' },
  procesando: { cls: 'badge-warn', txt: 'Procesando' },
  procesado: { cls: 'badge-ok', txt: 'Procesado' },
  fallido: { cls: 'badge-danger', txt: 'Fallido' },
}

export function EstadoBadge({ estado }: { estado: EstadoCola }) {
  const m = colaMap[estado]
  return <span className={`badge ${m.cls}`}><span className="dot" />{m.txt}</span>
}

export function Badge({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

// Donut hecho a mano con SVG (sin librerías de charts)
export function Donut({ data, size = 132, thickness = 16 }: { data: { label: string; value: number; color: string }[]; size?: number; thickness?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="row gap-16" style={{ alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} />
        {data.map((d, i) => {
          const len = (d.value / total) * c
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="round" />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="col gap-8">
        {data.map((d, i) => (
          <div key={i} className="row gap-8" style={{ fontSize: 13 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, display: 'inline-block' }} />
            <span className="muted" style={{ minWidth: 78 }}>{d.label}</span>
            <span className="mono" style={{ color: 'var(--text-hi)', fontWeight: 600 }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Sparkline / área
export function Sparkline({ values, w = 100, h = 40, color = 'var(--amber-500)' }: { values: number[]; w?: number; h?: number; color?: string }) {
  const max = Math.max(...values), min = Math.min(...values)
  const rng = max - min || 1
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / rng) * (h - 6) - 3}`)
  const id = 'g' + Math.round(values[0] * 7 + values.length)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`url(#${id})`} stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Barras verticales
export function Bars({ values, h = 72, color = 'var(--teal-500)' }: { values: number[]; h?: number; color?: string }) {
  const max = Math.max(...values) || 1
  return (
    <div className="row gap-6" style={{ height: h, alignItems: 'flex-end' }}>
      {values.map((v, i) => (
        <div key={i} title={String(v)} style={{
          flex: 1, height: `${(v / max) * 100}%`, minHeight: 3,
          background: `linear-gradient(180deg, ${color}, transparent)`,
          borderRadius: '4px 4px 2px 2px', opacity: i === values.length - 1 ? 1 : 0.65,
        }} />
      ))}
    </div>
  )
}

export function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="col center" style={{ padding: '48px 20px', textAlign: 'center', gap: 6 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-hi)' }}>{title}</div>
      {desc && <div className="muted" style={{ fontSize: 13 }}>{desc}</div>}
    </div>
  )
}
