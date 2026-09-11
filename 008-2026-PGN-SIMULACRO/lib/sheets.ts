import { Question, Perfil, PerfilSheet, Dificultad, Resumen, Flashcard } from './types'

let questionCache: Question[] | null = null
let summaryCache: Resumen[] | null = null
let flashcardCache: Flashcard[] | null = null

// Sheet público del banco de preguntas (ID no sensible; el env var lo puede sobrescribir)
const DEFAULT_SHEET_ID = '16S3fArXSV_2yAFOcK-49GD8yOzlG7du3mr8ztPGjEYI'

function sheetId(): string {
  return process.env.NEXT_PUBLIC_SHEET_ID || DEFAULT_SHEET_ID
}

async function fetchGvizJson(sheetName: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId()}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo cargar la pestaña «${sheetName}»`)
  return res.text()
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Respuesta inválida de Google Sheets')
  return JSON.parse(text.slice(start, end + 1))
}

function getRows(json: unknown): Array<{ c?: Array<{ v?: unknown }> }> {
  return (json as { table?: { rows?: Array<{ c?: Array<{ v?: unknown }> }> } })?.table?.rows ?? []
}

export async function fetchQuestions(): Promise<Question[]> {
  if (questionCache) return questionCache
  const text = await fetchGvizJson('preguntas')
  questionCache = parseGviz(text)
  return questionCache
}

// Quita el wrapper JSONP de gviz ("google.visualization.Query.setResponse(...)")
export function parseGviz(text: string): Question[] {
  const json = extractJson(text)
  const rows = getRows(json)
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

export async function fetchSummaries(): Promise<Resumen[]> {
  if (summaryCache) return summaryCache
  const text = await fetchGvizJson('resumenes')
  summaryCache = parseSummaries(text)
  return summaryCache
}

export function parseSummaries(text: string): Resumen[] {
  const json = extractJson(text)
  const rows = getRows(json)
  const items: Resumen[] = []
  for (const row of rows) {
    const c = row?.c ?? []
    if (c[3]?.v == null) continue
    items.push({
      id: Number(c[0]?.v ?? 0),
      perfil: String(c[1]?.v ?? 'Ambos') as PerfilSheet,
      tema: String(c[2]?.v ?? ''),
      titulo_seccion: String(c[3].v),
      contenido_html: String(c[4]?.v ?? ''),
      fuente_url: String(c[5]?.v ?? ''),
      orden: Number(c[6]?.v ?? 0),
    })
  }
  return items.sort((a, b) => a.orden - b.orden)
}

export async function fetchFlashcards(): Promise<Flashcard[]> {
  if (flashcardCache) return flashcardCache
  const text = await fetchGvizJson('flashcards')
  flashcardCache = parseFlashcards(text)
  return flashcardCache
}

export function parseFlashcards(text: string): Flashcard[] {
  const json = extractJson(text)
  const rows = getRows(json)
  const items: Flashcard[] = []
  for (const row of rows) {
    const c = row?.c ?? []
    if (c[3]?.v == null) continue
    items.push({
      id: Number(c[0]?.v ?? 0),
      perfil: String(c[1]?.v ?? 'Ambos') as PerfilSheet,
      tema: String(c[2]?.v ?? ''),
      frente: String(c[3].v),
      reverso: String(c[4]?.v ?? ''),
      norma: String(c[5]?.v ?? ''),
    })
  }
  return items
}

export function matchesPerfil<T extends { perfil: PerfilSheet }>(item: T, perfil: Perfil): boolean {
  return item.perfil === perfil || item.perfil === 'Ambos'
}

export function filterByPerfilAndTopic<T extends { perfil: PerfilSheet; tema: string }>(
  items: T[],
  perfil: Perfil,
  temaKey: string
): T[] {
  return items.filter((item) => item.tema === temaKey && matchesPerfil(item, perfil))
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
