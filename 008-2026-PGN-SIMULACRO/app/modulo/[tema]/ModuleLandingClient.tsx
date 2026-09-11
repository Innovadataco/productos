'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import ModuleCard from '@/components/ModuleCard'
import { useProfile } from '@/hooks/useProfile'
import { useProgress } from '@/hooks/useProgress'
import { CONV_BADGE, StageKey, StageStats, TOPICS } from '@/lib/types'
import { getStageStats } from '@/lib/storage'

interface Props {
  temaKey: string
}

export default function ModuleLandingClient({ temaKey }: Props) {
  const router = useRouter()
  const { perfil, ready, clear } = useProfile()
  const { progress } = useProgress(perfil)

  useEffect(() => {
    if (ready && !perfil) router.replace('/')
  }, [ready, perfil, router])

  const topic = useMemo(
    () => (perfil ? TOPICS[perfil].find((t) => t.key === temaKey) : undefined),
    [perfil, temaKey]
  )

  const stats = useMemo(
    () => (perfil ? getStageStats(progress, perfil, temaKey) : undefined),
    [progress, perfil, temaKey]
  )

  const swap = () => {
    clear()
    router.push('/')
  }

  if (!ready || !perfil || !topic || !stats) return null

  const stages: StageKey[] = ['resumen', 'flashcards', 'quiz', 'resultado']
  const nextStage = nextPendingStage(stats)

  return (
    <div>
      <Header badge={CONV_BADGE[perfil]} onSwap={swap} />

      <div className="mt-4 rounded-2xl p-4 text-white shadow-sm" style={{ backgroundColor: topic.color }}>
        <p className="text-xs font-semibold opacity-90">Módulo</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-3xl" aria-hidden>{topic.icon}</span>
          <div>
            <h1 className="text-xl font-extrabold">{topic.name}</h1>
            <p className="text-xs opacity-90">{topic.hours} de estudio</p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {stages.map((stage) => (
          <ModuleCard
            key={stage}
            stage={stage}
            stats={stats}
            href={`/modulo/${encodeURIComponent(temaKey)}/${stage}/`}
          />
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/home"
          className="flex-1 rounded-xl border border-gray-200 py-3 text-center text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          ← Volver al inicio
        </Link>
        <Link
          href={nextStage ? `/modulo/${encodeURIComponent(temaKey)}/${nextStage}/` : `/modulo/${encodeURIComponent(temaKey)}/`}
          className="flex-1 rounded-xl py-3 text-center text-sm font-bold text-white"
          style={{ backgroundColor: topic.color }}
        >
          {nextStage ? 'Continuar' : 'Completado'}
        </Link>
      </div>
    </div>
  )
}

function nextPendingStage(stats: StageStats): StageKey | null {
  if (!stats.resumen_done) return 'resumen'
  if (!stats.flashcards_done) return 'flashcards'
  if (stats.quiz_total === 0) return 'quiz'
  if (!stats.resultado_seen) return 'resultado'
  return null
}
