import { Question, Perfil, PerfilSheet, Dificultad } from './types'

let cache: Question[] | null = null

// Sheet público del banco de preguntas (ID no sensible; el env var lo puede sobrescribir)
const DEFAULT_SHEET_ID = '1YUaeT30qe8noSRecCWuTb-Aah12iEt4fEcCThN2BDKU'

export async function fetchQuestions(): Promise<Question[]> {
  if (cache) return cache
  const sheetId = process.env.NEXT_PUBLIC_SHEET_ID || DEFAULT_SHEET_ID
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo cargar el banco de preguntas')
  const text = await res.text()
  cache = parseGviz(text)
  return cache
}

// Quita el wrapper JSONP de gviz ("google.visualization.Query.setResponse(...)")
export function parseGviz(text: string): Question[] {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Respuesta inválida de Google Sheets')
  const json = JSON.parse(text.slice(start, end + 1))
  const rows = json?.table?.rows ?? []
  const questions: Question[] = []
  for (const row of rows) {
    const c = row?.c ?? []
    if (c[3]?.v == null) continue
    questions.push({
      id: Number(c[0]?.v ?? 0),
      perfil: String(c[1]?.v ?? 'Ambos') as PerfilSheet,
      tema: String(c[2]?.v ?? ''),
      pregunta: String(c[3].v),
      opciones: [
        String(c[4]?.v ?? ''),
        String(c[5]?.v ?? ''),
        String(c[6]?.v ?? ''),
        String(c[7]?.v ?? ''),
      ],
      respuesta: Number(c[8]?.v ?? 0),
      explicacion: String(c[9]?.v ?? ''),
      norma: String(c[10]?.v ?? ''),
      dificultad: String(c[11]?.v ?? 'medio') as Dificultad,
    })
  }
  return questions
}

export function matchesPerfil(q: Question, perfil: Perfil): boolean {
  return q.perfil === perfil || q.perfil === 'Ambos'
}

export function filterQuestions(all: Question[], perfil: Perfil, temaKey: string): Question[] {
  if (temaKey.startsWith('Mixto')) return all.filter((q) => matchesPerfil(q, perfil))
  return all.filter((q) => q.tema === temaKey && matchesPerfil(q, perfil))
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function countByTopic(all: Question[], perfil: Perfil, temaKey: string): number {
  return filterQuestions(all, perfil, temaKey).length
}
