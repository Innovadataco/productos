'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import TopicCard from '@/components/TopicCard'
import SkeletonCard from '@/components/SkeletonCard'
import { useProfile } from '@/hooks/useProfile'
import { useProgress } from '@/hooks/useProgress'
import { fetchQuestions, filterQuestions, matchesPerfil } from '@/lib/sheets'
import { getTopicStats, perfilTotals } from '@/lib/storage'
import { CONV_BADGE, Question, TOPICS } from '@/lib/types'

export default function Home() {
  const router = useRouter()
  const { perfil, ready, clear } = useProfile()
  const { progress } = useProgress(perfil)
  const [bank, setBank] = useState<Question[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && !perfil) router.replace('/')
  }, [ready, perfil, router])

  const load = () => {
    if (!perfil) return
    setError(null)
    fetchQuestions()
      .then((all) => setBank(all.filter((q) => matchesPerfil(q, perfil))))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Error al cargar el banco')
      )
  }

  useEffect(() => {
    setBank(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    if (bank && perfil) {
      for (const t of TOPICS[perfil]) map[t.key] = filterQuestions(bank, perfil, t.key).length
    }
    return map
  }, [bank, perfil])

  if (!ready || !perfil) return null

  const totals = perfilTotals(progress, perfil)
  const pct = totals.total > 0 ? Math.round((totals.correct / totals.total) * 100) : 0

  const swap = () => {
    clear()
    router.push('/')
  }

  return (
    <div>
      <Header badge={CONV_BADGE[perfil]} onSwap={swap} />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatCard label="Respondidas" value={String(totals.total)} />
        <StatCard label="% correctas" value={totals.total > 0 ? `${pct}%` : '—'} />
        <StatCard label="Total banco" value={bank === null ? '…' : String(bank.length)} />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">No se pudo cargar el banco de preguntas</p>
          <p className="mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      )}

      <h2 className="mt-6 mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
        Temas
      </h2>
      {bank === null && !error ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="space-y-3">
          {TOPICS[perfil].map((t) => (
            <TopicCard
              key={t.key}
              topic={t}
              count={counts[t.key] ?? 0}
              stats={getTopicStats(progress, perfil, t.key)}
            />
          ))}
        </div>
      )}

      <button
        onClick={swap}
        className="mt-6 w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
      >
        Cambiar perfil
      </button>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm">
      <p className="text-xl font-extrabold text-gray-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-gray-500">{label}</p>
    </div>
  )
}
