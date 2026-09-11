'use client'

import { useEffect, useState } from 'react'
import { Perfil, Resumen } from '@/lib/types'
import { fetchSummaries, filterByPerfilAndTopic } from '@/lib/sheets'

export function useSummaries(perfil: Perfil | null, temaKey: string | null) {
  const [items, setItems] = useState<Resumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!perfil || !temaKey) return
    let cancelled = false
    setItems(null)
    setError(null)
    fetchSummaries()
      .then((all) => {
        if (cancelled) return
        setItems(filterByPerfilAndTopic(all, perfil, temaKey))
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al cargar los resúmenes')
      })
    return () => {
      cancelled = true
    }
  }, [perfil, temaKey, attempt])

  const retry = () => setAttempt((n) => n + 1)

  return { items, error, retry }
}
