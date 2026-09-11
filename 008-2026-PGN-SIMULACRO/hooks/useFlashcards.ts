'use client'

import { useEffect, useState } from 'react'
import { Flashcard, Perfil } from '@/lib/types'
import { fetchFlashcards, filterByPerfilAndTopic, shuffle } from '@/lib/sheets'

export function useFlashcards(perfil: Perfil | null, temaKey: string | null) {
  const [items, setItems] = useState<Flashcard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!perfil || !temaKey) return
    let cancelled = false
    setItems(null)
    setError(null)
    fetchFlashcards()
      .then((all) => {
        if (cancelled) return
        const filtered = filterByPerfilAndTopic(all, perfil, temaKey)
        setItems(shuffle(filtered))
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al cargar las flashcards')
      })
    return () => {
      cancelled = true
    }
  }, [perfil, temaKey, attempt])

  const retry = () => setAttempt((n) => n + 1)

  return { items, error, retry }
}
