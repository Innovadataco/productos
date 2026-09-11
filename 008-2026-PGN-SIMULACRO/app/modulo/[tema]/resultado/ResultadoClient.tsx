'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import ScoreRing from '@/components/ScoreRing'
import ResultReview, { WrongAnswer } from '@/components/ResultReview'
import { useProfile } from '@/hooks/useProfile'
import { useProgress } from '@/hooks/useProgress'
import { getLastQuizSession, getStageStats } from '@/lib/storage'
import { CONV_BADGE, TOPICS } from '@/lib/types'

interface Props {
  temaKey: string
}

export default function ResultadoClientWrapper({ temaKey }: Props) {
  return (
    <Suspense fallback={null}>
      <ResultadoClient temaKey={temaKey} />
    </Suspense>
  )
}

function ResultadoClient({ temaKey }: Props) {
  const router = useRouter()
  const search = useSearchParams()
  const { perfil, ready, clear } = useProfile()
  const { progress, addResult, markResultado } = useProgress(perfil)

  const correctRaw = search.get('correct')
  const totalRaw = search.get('total')
  const hasScore = correctRaw !== null && totalRaw !== null

  useEffect(() => {
    if (ready && !perfil) router.replace('/')
  }, [ready, perfil, router])

  useEffect(() => {
    if (ready && perfil && hasScore) {
      addResult(temaKey, Number(correctRaw), Number(totalRaw))
      markResultado(temaKey)
    }
  }, [ready, perfil, hasScore, temaKey, correctRaw, totalRaw, addResult, markResultado, router])

  const swap = () => {
    clear()
    router.push('/')
  }

  const topic = useMemo(
    () => (perfil ? TOPICS[perfil].find((t) => t.key === temaKey) : undefined),
    [perfil, temaKey]
  )

  const nextTopic = useMemo(() => {
    if (!perfil) return null
    const topics = TOPICS[perfil]
    const idx = topics.findIndex((t) => t.key === temaKey)
    return idx >= 0 && idx < topics.length - 1 ? topics[idx + 1] : null
  }, [perfil, temaKey])

  const wrong = useMemo<WrongAnswer[]>(() => {
    const session = typeof window !== 'undefined' ? getLastQuizSession() : null
    if (!session || session.tema !== temaKey || session.answers.length === 0) return []
    const out: WrongAnswer[] = []
    session.questions.forEach((q, i) => {
      const selected = session.answers[i]
      if (selected !== q.respuesta) {
        out.push({ question: q, selectedIndex: selected })
      }
    })
    return out
  }, [temaKey])

  if (!ready || !perfil) return null

  if (!hasScore) {
    return (
      <div>
        <Header badge={CONV_BADGE[perfil]} onSwap={swap} />
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
          <p className="font-semibold text-gray-900">No hay resultado para mostrar</p>
          <button
            onClick={() => router.push(`/modulo/${encodeURIComponent(temaKey)}/`)}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: '#0b6e5a' }}
          >
            Volver al módulo
          </button>
        </div>
      </div>
    )
  }

  const correct = Number(correctRaw)
  const total = Number(totalRaw)
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0
  const stats = getStageStats(progress, perfil, temaKey)

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

      <ResultReview wrong={wrong} />

      <div className="mt-6 space-y-3">
        <button
          onClick={() => router.push(`/modulo/${encodeURIComponent(temaKey)}/quiz/`)}
          className="w-full rounded-xl py-3 text-sm font-bold text-white"
          style={{ backgroundColor: '#0b6e5a' }}
        >
          Repetir quiz
        </button>
        <button
          onClick={() => router.push(`/modulo/${encodeURIComponent(temaKey)}/`)}
          className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Volver al módulo
        </button>
        {nextTopic ? (
          <button
            onClick={() => router.push(`/modulo/${encodeURIComponent(nextTopic.key)}/`)}
            className="w-full rounded-xl py-3 text-sm font-bold text-white"
            style={{ backgroundColor: topic?.color ?? '#0b6e5a' }}
          >
            Siguiente tema →
          </button>
        ) : (
          <button
            onClick={() => router.push('/home')}
            className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Volver al inicio
          </button>
        )}
      </div>

      {stats.quiz_total > 0 && (
        <p className="mt-4 text-center text-xs text-gray-500">
          Acumulado en este tema: {stats.quiz_correct}/{stats.quiz_total} correctas
        </p>
      )}
    </div>
  )
}
