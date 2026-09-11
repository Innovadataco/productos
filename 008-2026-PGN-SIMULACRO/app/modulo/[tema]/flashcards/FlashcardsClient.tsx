'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Flashcard from '@/components/Flashcard'
import SkeletonCard from '@/components/SkeletonCard'
import ScoreRing from '@/components/ScoreRing'
import { useProfile } from '@/hooks/useProfile'
import { useProgress } from '@/hooks/useProgress'
import { useFlashcards } from '@/hooks/useFlashcards'
import { CONV_BADGE, TOPICS } from '@/lib/types'

interface Props {
  temaKey: string
}

export default function FlashcardsClient({ temaKey }: Props) {
  const router = useRouter()
  const { perfil, ready, clear } = useProfile()
  const { saveFlashcards } = useProgress(perfil)
  const { items, error, retry } = useFlashcards(perfil, ready ? temaKey : null)

  const [index, setIndex] = useState(0)
  const [known, setKnown] = useState(0)
  const [finished, setFinished] = useState(false)

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

  useEffect(() => {
    // Reiniciar estado cuando cambia el mazo
    setIndex(0)
    setKnown(0)
    setFinished(false)
  }, [items])

  if (!ready || !perfil) return null

  if (error) {
    return (
      <div>
        <Header badge={CONV_BADGE[perfil]} onSwap={swap} />
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">No se pudieron cargar las flashcards</p>
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
          <p className="text-3xl" aria-hidden>🃏</p>
          <p className="mt-2 font-semibold text-gray-900">Sin flashcards para este tema</p>
          <p className="mt-1">Aún no hay tarjetas de «{topic?.name ?? temaKey}».</p>
          <button
            onClick={() => router.push(`/modulo/${encodeURIComponent(temaKey)}/quiz/`)}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: '#0b6e5a' }}
          >
            Ir al Quiz →
          </button>
        </div>
      </div>
    )
  }

  const finish = (finalKnown: number) => {
    const score = (finalKnown / items.length) * 100
    saveFlashcards(temaKey, score)
    setFinished(true)
  }

  const handleKnow = () => {
    const nextKnown = known + 1
    if (index === items.length - 1) {
      finish(nextKnown)
    } else {
      setKnown(nextKnown)
      setIndex((n) => n + 1)
    }
  }

  const handleReview = () => {
    if (index === items.length - 1) {
      finish(known)
    } else {
      setIndex((n) => n + 1)
    }
  }

  if (finished) {
    const score = Math.round((known / items.length) * 100)
    return (
      <div>
        <Header badge={CONV_BADGE[perfil]} onSwap={swap} />
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-extrabold text-gray-900">Flashcards completadas</h1>
          <div className="mt-4">
            <ScoreRing percent={score} />
          </div>
          <p className="mt-3 text-sm text-gray-600">
            <span className="font-bold text-gray-900">{known}</span> de{' '}
            <span className="font-bold text-gray-900">{items.length}</span> tarjetas dominadas
          </p>
          <button
            onClick={() => router.push(`/modulo/${encodeURIComponent(temaKey)}/quiz/`)}
            className="mt-6 w-full rounded-xl py-3 text-sm font-bold text-white"
            style={{ backgroundColor: '#0b6e5a' }}
          >
            Ir al Quiz →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header badge={CONV_BADGE[perfil]} onSwap={swap} />

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xl" aria-hidden>{topic?.icon ?? '🃏'}</span>
        <p className="text-sm font-semibold text-gray-700">{topic?.name ?? temaKey}</p>
      </div>

      <h1 className="mt-4 text-lg font-extrabold text-gray-900">Flashcards</h1>

      <div className="mt-4">
        <Flashcard
          card={items[index]}
          index={index}
          total={items.length}
          onKnow={handleKnow}
          onReview={handleReview}
        />
      </div>
    </div>
  )
}
