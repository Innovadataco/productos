'use client'

import { useCallback, useEffect, useState } from 'react'
import { Perfil, Progress } from '@/lib/types'
import {
  getProgress,
  markResumenDone,
  saveFlashcardsResult,
  saveQuizResult,
  markResultadoSeen,
} from '@/lib/storage'

export function useProgress(perfil: Perfil | null) {
  const [progress, setProgress] = useState<Progress>({})

  const refresh = useCallback(() => {
    setProgress(getProgress())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, perfil])

  const setAndPersist = useCallback(
    (updater: (prev: Progress) => Progress) => {
      setProgress((prev) => updater(prev))
    },
    []
  )

  const markResumen = useCallback(
    (tema: string) => {
      if (!perfil) return
      setAndPersist((prev) => markResumenDone(prev, perfil, tema))
    },
    [perfil, setAndPersist]
  )

  const saveFlashcards = useCallback(
    (tema: string, scorePercent: number) => {
      if (!perfil) return
      setAndPersist((prev) => saveFlashcardsResult(prev, perfil, tema, scorePercent))
    },
    [perfil, setAndPersist]
  )

  const addResult = useCallback(
    (tema: string, correct: number, total: number) => {
      if (!perfil) return
      setAndPersist((prev) => saveQuizResult(prev, perfil, tema, correct, total))
    },
    [perfil, setAndPersist]
  )

  const markResultado = useCallback(
    (tema: string) => {
      if (!perfil) return
      setAndPersist((prev) => markResultadoSeen(prev, perfil, tema))
    },
    [perfil, setAndPersist]
  )

  return { progress, refresh, markResumen, saveFlashcards, addResult, markResultado }
}
