'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import ProgressBar from '@/components/ProgressBar'
import OptionButton, { OptionState } from '@/components/OptionButton'
import FeedbackBox from '@/components/FeedbackBox'
import SkeletonCard from '@/components/SkeletonCard'
import { useProfile } from '@/hooks/useProfile'
import { useProgress } from '@/hooks/useProgress'
import { useQuestions } from '@/hooks/useQuestions'
import { saveLastQuizSession } from '@/lib/storage'
import { CONV_BADGE, TOPICS } from '@/lib/types'

export default function QuizClient({ temaKey }: { temaKey: string }) {
  const router = useRouter()
  const { perfil, ready, clear } = useProfile()
  const { addResult } = useProgress(perfil)
  const { questions, error, retry } = useQuestions(perfil, ready ? temaKey : null)

  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])

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
          <p className="font-semibold">No se pudieron cargar las preguntas</p>
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

  if (!questions) {
    return (
      <div>
        <Header badge={CONV_BADGE[perfil]} onSwap={swap} />
        <div className="mt-4 space-y-3">
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div>
        <Header badge={CONV_BADGE[perfil]} onSwap={swap} />
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
          <p className="text-3xl" aria-hidden>🗂️</p>
          <p className="mt-2 font-semibold text-gray-900">Sin preguntas para este tema</p>
          <p className="mt-1">Aún no hay preguntas de «{topic?.name ?? temaKey}» en el banco.</p>
          <button
            onClick={() => router.push('/home')}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: '#0b6e5a' }}
          >
            Elegir otro tema
          </button>
        </div>
      </div>
    )
  }

  const question = questions[index]
  const isLast = index === questions.length - 1

  const choose = (i: number) => {
    if (selected !== null) return
    setSelected(i)
    setAnswers((prev) => [...prev, i])
    if (i === question.respuesta) setCorrectCount((n) => n + 1)
  }

  const next = () => {
    if (isLast) {
      addResult(temaKey, correctCount, questions.length)
      saveLastQuizSession({
        tema: temaKey,
        questions,
        answers: [...answers, selected ?? -1],
        correct: correctCount,
        total: questions.length,
        at: Date.now(),
      })
      router.push(`/modulo/${encodeURIComponent(temaKey)}/resultado?correct=${correctCount}&total=${questions.length}`)
    } else {
      setIndex((n) => n + 1)
      setSelected(null)
    }
  }

  const optionState = (i: number): OptionState => {
    if (selected === null) return 'default'
    if (i === question.respuesta) return 'correct'
    if (i === selected) return 'incorrect'
    return 'faded'
  }

  return (
    <div>
      <Header badge={CONV_BADGE[perfil]} onSwap={swap} />

      <div className="mt-2 flex items-center gap-2">
        <span className="text-xl" aria-hidden>{topic?.icon ?? '📝'}</span>
        <p className="text-sm font-semibold text-gray-700">{topic?.name ?? temaKey}</p>
      </div>

      <div className="mt-3">
        <ProgressBar current={index + 1} total={questions.length} />
      </div>

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: topic?.color ?? '#0b6e5a' }}>
          {question.dificultad}
        </p>
        <p className="mt-1 text-base font-medium text-gray-900">{question.pregunta}</p>
      </div>

      <div className="mt-4 space-y-2">
        {question.opciones.map((op, i) => (
          <OptionButton
            key={i}
            index={i}
            label={op}
            state={optionState(i)}
            disabled={selected !== null}
            onClick={() => choose(i)}
          />
        ))}
      </div>

      {selected !== null && (
        <div className="mt-4 space-y-4">
          <FeedbackBox explicacion={question.explicacion} norma={question.norma} />
          <button
            onClick={next}
            className="w-full rounded-xl py-3 text-sm font-bold text-white"
            style={{ backgroundColor: '#0b6e5a' }}
          >
            {isLast ? 'Ver resultados →' : 'Siguiente →'}
          </button>
        </div>
      )}
    </div>
  )
}
