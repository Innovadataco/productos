'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import ScoreRing from '@/components/ScoreRing'
import { useProfile } from '@/hooks/useProfile'
import { useProgress } from '@/hooks/useProgress'
import { getTopicStats, perfilTotals } from '@/lib/storage'
import { CONV_BADGE, TOPICS } from '@/lib/types'

export default function ResultClient({ temaKey }: { temaKey: string }) {
  return (
    <Suspense fallback={null}>
      <ResultInner temaKey={temaKey} />
    </Suspense>
  )
}

function ResultInner({ temaKey }: { temaKey: string }) {
  const router = useRouter()
  const search = useSearchParams()
  const { perfil, ready, clear } = useProfile()
  const { progress } = useProgress(perfil)

  const correctRaw = search.get('correct')
  const totalRaw = search.get('total')
  const hasScore = correctRaw !== null && totalRaw !== null

  useEffect(() => {
    if (ready && !perfil) router.replace('/')
  }, [ready, perfil, router])

  useEffect(() => {
    if (ready && perfil && !hasScore) router.replace('/home')
  }, [ready, perfil, hasScore, router])

  const swap = () => {
    clear()
    router.push('/')
  }

  if (!ready || !perfil || !hasScore) return null

  const correct = Number(correctRaw)
  const total = Number(totalRaw)
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) {
    return (
      <div>
        <Header badge={CONV_BADGE[perfil]} onSwap={swap} />
        <div className="mt-8 text-center text-sm text-gray-500">
          <button
            onClick={() => router.push('/home')}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: '#0b6e5a' }}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  const percent = Math.round((correct / total) * 100)
  const topic = TOPICS[perfil].find((t) => t.key === temaKey)
  const grand = perfilTotals(progress, perfil)

  return (
    <div>
      <Header badge={CONV_BADGE[perfil]} onSwap={swap} />

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-extrabold text-gray-900">{topic?.name ?? temaKey}</h1>
        <div className="mt-4">
          <ScoreRing percent={percent} />
        </div>
        <p className="mt-3 text-sm text-gray-600">
          <span className="font-bold text-gray-900">{correct}</span> de{' '}
          <span className="font-bold text-gray-900">{total}</span> correctas
        </p>
      </div>

      <h2 className="mt-6 mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
        Acumulado por tema
      </h2>
      <div className="space-y-2">
        {TOPICS[perfil].map((t) => {
          const s = getTopicStats(progress, perfil, t.key)
          const p = s.total > 0 ? Math.round((s.correct / s.total) * 100) : null
          return (
            <div
              key={t.key}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
            >
              <span className="flex items-center gap-2 text-gray-700">
                <span aria-hidden>{t.icon}</span>
                {t.name}
              </span>
              <span className="font-semibold text-gray-900">
                {s.total > 0 ? `${s.correct}/${s.total} · ${p}%` : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {grand.total > 0 && (
        <p className="mt-4 text-center text-xs text-gray-500">
          Total {perfil === 'Jelkin' ? 'Jelkin' : 'Diana'}: {grand.correct}/{grand.total} correctas
        </p>
      )}

      <div className="mt-6 space-y-3">
        <button
          onClick={() => router.push(`/quiz/${encodeURIComponent(temaKey)}`)}
          className="w-full rounded-xl py-3 text-sm font-bold text-white"
          style={{ backgroundColor: '#0b6e5a' }}
        >
          Repetir tema
        </button>
        <button
          onClick={() => router.push('/home')}
          className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Elegir otro tema
        </button>
      </div>
    </div>
  )
}
