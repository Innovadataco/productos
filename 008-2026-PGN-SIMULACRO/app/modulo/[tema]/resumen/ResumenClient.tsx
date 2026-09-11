'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import SummaryViewer from '@/components/SummaryViewer'
import SkeletonCard from '@/components/SkeletonCard'
import { useProfile } from '@/hooks/useProfile'
import { useProgress } from '@/hooks/useProgress'
import { useSummaries } from '@/hooks/useSummaries'
import { CONV_BADGE, TOPICS } from '@/lib/types'

interface Props {
  temaKey: string
}

export default function ResumenClient({ temaKey }: Props) {
  const router = useRouter()
  const { perfil, ready, clear } = useProfile()
  const { markResumen } = useProgress(perfil)
  const { items, error, retry } = useSummaries(perfil, ready ? temaKey : null)

  useEffect(() => {
    if (ready && !perfil) router.replace('/')
  }, [ready, perfil, router])

  const topic = useMemo(
    () => (perfil ? TOPICS[perfil].find((t) => t.key === temaKey) : undefined),
    [perfil, temaKey]
  )

  const swap = () => {
    clear()
    router.push('/')
  }

  if (!ready || !perfil) return null

  if (error) {
    return (
      <div>
        <Header badge={CONV_BADGE[perfil]} onSwap={swap} />
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">No se pudieron cargar los resúmenes</p>
          <p className="mt-1">{error}</p>
          <button
            onClick={retry}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!items) {
    return (
      <div>
        <Header badge={CONV_BADGE[perfil]} onSwap={swap} />
        <div className="mt-4 space-y-3">
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div>
        <Header badge={CONV_BADGE[perfil]} onSwap={swap} />
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
          <p className="text-3xl" aria-hidden>📖</p>
          <p className="mt-2 font-semibold text-gray-900">Sin resumen para este tema</p>
          <p className="mt-1">Aún no hay secciones de resumen de «{topic?.name ?? temaKey}».</p>
          <button
            onClick={() => router.push(`/modulo/${encodeURIComponent(temaKey)}/flashcards/`)}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: '#0b6e5a' }}
          >
            Ir a Flashcards →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header badge={CONV_BADGE[perfil]} onSwap={swap} />

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xl" aria-hidden>{topic?.icon ?? '📖'}</span>
        <p className="text-sm font-semibold text-gray-700">{topic?.name ?? temaKey}</p>
      </div>

      <h1 className="mt-4 text-lg font-extrabold text-gray-900">Resumen</h1>

      <SummaryViewer
        items={items}
        onLastReached={() => markResumen(temaKey)}
        onDone={() => router.push(`/modulo/${encodeURIComponent(temaKey)}/flashcards/`)}
      />
    </div>
  )
}
