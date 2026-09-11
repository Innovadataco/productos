'use client'

import { useEffect, useState } from 'react'
import { Perfil } from '@/lib/types'
import { getPerfil, setPerfil, clearPerfil } from '@/lib/storage'

export function useProfile() {
  const [perfil, setPerfilState] = useState<Perfil | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setPerfilState(getPerfil())
    setReady(true)
  }, [])

  const select = (p: Perfil) => {
    setPerfil(p)
    setPerfilState(p)
  }

  const clear = () => {
    clearPerfil()
    setPerfilState(null)
  }

  return { perfil, ready, select, clear }
}
