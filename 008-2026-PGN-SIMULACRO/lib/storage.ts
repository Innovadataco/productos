import { Perfil, Progress, TopicStats } from './types'

const PERFIL_KEY = 'pgn_perfil'
const PROGRESS_KEY = 'pgn_progress'

export function getPerfil(): Perfil | null {
  const v = localStorage.getItem(PERFIL_KEY)
  return v === 'Jelkin' || v === 'Diana' ? v : null
}

export function setPerfil(perfil: Perfil): void {
  localStorage.setItem(PERFIL_KEY, perfil)
}

export function clearPerfil(): void {
  localStorage.removeItem(PERFIL_KEY)
}

export function getProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as Progress) : {}
  } catch {
    return {}
  }
}

export function getTopicStats(progress: Progress, perfil: Perfil, tema: string): TopicStats {
  return progress[perfil]?.[tema] ?? { correct: 0, total: 0 }
}

// Suma resultados a lo acumulado y persiste. Retorna el progreso completo.
export function addTopicStats(perfil: Perfil, tema: string, correct: number, total: number): Progress {
  const progress = getProgress()
  const prev = progress[perfil]?.[tema] ?? { correct: 0, total: 0 }
  const perfilProgress = { ...(progress[perfil] ?? {}) }
  perfilProgress[tema] = { correct: prev.correct + correct, total: prev.total + total }
  const next: Progress = { ...progress, [perfil]: perfilProgress }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(next))
  return next
}

export function perfilTotals(progress: Progress, perfil: Perfil): TopicStats {
  const topics = progress[perfil] ?? {}
  let correct = 0
  let total = 0
  for (const stats of Object.values(topics)) {
    correct += stats.correct
    total += stats.total
  }
  return { correct, total }
}
