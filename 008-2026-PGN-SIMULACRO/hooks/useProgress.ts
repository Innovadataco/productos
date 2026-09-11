'use client'

import { useCallback, useEffect, useState } from 'react'
import { Perfil, Progress } from '@/lib/types'
import { getProgress, addTopicStats } from '@/lib/storage'

export function useProgress(perfil: Perfil | null) {
  const [progress, setProgress] = useState<Progress>({})

  const refresh = useCallback(() => {
    setProgress(getProgress())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh, perfil])

  const addResult = useCallback(
    (tema: string, correct: number, total: number) => {
      if (!perfil) return
      setProgress(addTopicStats(perfil, tema, correct, total))
    },
    [perfil]
  )

  return { progress, addResult, refresh }
}
