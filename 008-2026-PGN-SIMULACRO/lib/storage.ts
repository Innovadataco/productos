import { Perfil, Progress, StageStats, TopicStats, Question } from './types'

const PERFIL_KEY = 'pgn_perfil'
const PROGRESS_KEY = 'pgn_progress'
const LAST_QUIZ_KEY = 'pgn_last_quiz'

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

function defaultStageStats(): StageStats {
  return {
    resumen_done: false,
    flashcards_done: false,
    flashcards_score: 0,
    quiz_correct: 0,
    quiz_total: 0,
    resultado_seen: false,
  }
}

function migrateLegacy(stats: unknown): StageStats {
  const s = stats as Partial<StageStats & TopicStats> | null | undefined
  const next = defaultStageStats()
  if (!s) return next
  if (typeof s.resumen_done === 'boolean') next.resumen_done = s.resumen_done
  if (typeof s.flashcards_done === 'boolean') next.flashcards_done = s.flashcards_done
  if (typeof s.flashcards_score === 'number') next.flashcards_score = s.flashcards_score
  if (typeof s.quiz_correct === 'number') next.quiz_correct = s.quiz_correct
  if (typeof s.quiz_total === 'number') next.quiz_total = s.quiz_total
  if (typeof s.resultado_seen === 'boolean') next.resultado_seen = s.resultado_seen
  // Migración desde progreso antiguo {correct,total}
  if (typeof s.correct === 'number' && typeof s.total === 'number') {
    next.quiz_correct = s.correct
    next.quiz_total = s.total
  }
  return next
}

export function getProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Progress
    const migrated: Progress = {}
    for (const perfil of ['Jelkin', 'Diana'] as Perfil[]) {
      const topics = parsed[perfil]
      if (!topics) continue
      migrated[perfil] = {}
      for (const [tema, stats] of Object.entries(topics)) {
        migrated[perfil]![tema] = migrateLegacy(stats)
      }
    }
    return migrated
  } catch {
    return {}
  }
}

function setProgress(progress: Progress): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

export function getStageStats(progress: Progress, perfil: Perfil, tema: string): StageStats {
  return progress[perfil]?.[tema] ?? defaultStageStats()
}

// Compatibilidad: presenta las stats del quiz como {correct,total}
export function getTopicStats(progress: Progress, perfil: Perfil, tema: string): TopicStats {
  const s = getStageStats(progress, perfil, tema)
  return { correct: s.quiz_correct, total: s.quiz_total }
}

function updateStageStats(
  progress: Progress,
  perfil: Perfil,
  tema: string,
  updater: (s: StageStats) => StageStats
): Progress {
  const next: Progress = { ...progress }
  const perfilMap: { [tema: string]: StageStats } = { ...(next[perfil] ?? {}) }
  perfilMap[tema] = updater(getStageStats(progress, perfil, tema))
  next[perfil] = perfilMap
  setProgress(next)
  return next
}

export function markResumenDone(progress: Progress, perfil: Perfil, tema: string): Progress {
  return updateStageStats(progress, perfil, tema, (s) => ({ ...s, resumen_done: true }))
}

export function saveFlashcardsResult(
  progress: Progress,
  perfil: Perfil,
  tema: string,
  scorePercent: number
): Progress {
  return updateStageStats(progress, perfil, tema, (s) => ({
    ...s,
    flashcards_done: true,
    flashcards_score: Math.round(scorePercent),
  }))
}

export function saveQuizResult(
  progress: Progress,
  perfil: Perfil,
  tema: string,
  correct: number,
  total: number
): Progress {
  return updateStageStats(progress, perfil, tema, (s) => ({
    ...s,
    quiz_correct: s.quiz_correct + correct,
    quiz_total: s.quiz_total + total,
  }))
}

export function markResultadoSeen(progress: Progress, perfil: Perfil, tema: string): Progress {
  return updateStageStats(progress, perfil, tema, (s) => ({ ...s, resultado_seen: true }))
}

// Wrapper legacy; suma resultados al quiz acumulado y persiste.
export function addTopicStats(perfil: Perfil, tema: string, correct: number, total: number): Progress {
  return saveQuizResult(getProgress(), perfil, tema, correct, total)
}

export function perfilTotals(progress: Progress, perfil: Perfil): TopicStats {
  const topics = progress[perfil] ?? {}
  let correct = 0
  let total = 0
  for (const stats of Object.values(topics)) {
    correct += stats.quiz_correct
    total += stats.quiz_total
  }
  return { correct, total }
}

export interface LastQuizSession {
  tema: string
  questions: Question[]
  answers: number[]
  correct: number
  total: number
  at: number
}

export function saveLastQuizSession(session: LastQuizSession): void {
  localStorage.setItem(LAST_QUIZ_KEY, JSON.stringify(session))
}

export function getLastQuizSession(): LastQuizSession | null {
  try {
    const raw = localStorage.getItem(LAST_QUIZ_KEY)
    return raw ? (JSON.parse(raw) as LastQuizSession) : null
  } catch {
    return null
  }
}

export function clearLastQuizSession(): void {
  localStorage.removeItem(LAST_QUIZ_KEY)
}
