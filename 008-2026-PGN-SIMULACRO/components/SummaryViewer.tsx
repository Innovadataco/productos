'use client'

import { useEffect, useState } from 'react'
import { Resumen } from '@/lib/types'
import ProgressBar from './ProgressBar'

interface Props {
  items: Resumen[]
  onLastReached?: () => void
  onDone?: () => void
}

export default function SummaryViewer({ items, onLastReached, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const current = items[index]
  const isFirst = index === 0
  const isLast = index === items.length - 1

  useEffect(() => {
    if (isLast) onLastReached?.()
  }, [isLast, onLastReached])

  const next = () => {
    if (isLast) {
      onDone?.()
    } else {
      setIndex((n) => n + 1)
    }
  }

  const prev = () => setIndex((n) => Math.max(0, n - 1))

  return (
    <div>
      <ProgressBar current={index + 1} total={items.length} />

      <article className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-gray-900">{current.titulo_seccion}</h2>
        <div
          className="prose prose-sm mt-3 max-w-none text-sm leading-relaxed text-gray-700"
          dangerouslySetInnerHTML={{ __html: current.contenido_html }}
        />
        {current.fuente_url && (
          <a
            href={current.fuente_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-xs font-medium underline"
            style={{ color: '#0b6e5a' }}
          >
            Ver fuente
          </a>
        )}
      </article>

      <div className="mt-4 flex gap-3">
        <button
          onClick={prev}
          disabled={isFirst}
          className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          ← Anterior
        </button>
        <button
          onClick={next}
          className="flex-1 rounded-xl py-3 text-sm font-bold text-white"
          style={{ backgroundColor: '#0b6e5a' }}
        >
          {isLast ? 'Ir a Flashcards →' : 'Siguiente →'}
        </button>
      </div>
    </div>
  )
}
