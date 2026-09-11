'use client'

import { useEffect, useState } from 'react'
import { Question, Perfil } from '@/lib/types'
import { fetchQuestions, filterQuestions, shuffle } from '@/lib/sheets'

const MIXTO_LIMIT = 20

export function useQuestions(perfil: Perfil | null, temaKey: string | null) {
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!perfil || !temaKey) return
    let cancelled = false
    setQuestions(null)
    setError(null)
    fetchQuestions()
      .then((all) => {
        if (cancelled) return
        let qs = shuffle(filterQuestions(all, perfil, temaKey))
        if (temaKey.startsWith('Mixto') && qs.length > MIXTO_LIMIT) qs = qs.slice(0, MIXTO_LIMIT)
        setQuestions(qs)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al cargar las preguntas')
      })
    return () => {
      cancelled = true
    }
  }, [perfil, temaKey, attempt])

  const retry = () => setAttempt((n) => n + 1)

  return { questions, error, retry }
}
