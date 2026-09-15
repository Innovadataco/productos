import { Perfil, Tema, Pregunta, Resumen, Flashcard, Resultado } from './types';

const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX || '/data';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}.json`);
  if (!res.ok) {
    throw new Error(`Error cargando ${path}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getPerfiles(): Promise<Perfil[]> {
  return fetchJson<Perfil[]>('/perfiles');
}

export async function getTemas(): Promise<Tema[]> {
  return fetchJson<Tema[]>('/temas');
}

export async function getPreguntas(): Promise<Pregunta[]> {
  return fetchJson<Pregunta[]>('/preguntas');
}

export async function getResumenes(): Promise<Resumen[]> {
  return fetchJson<Resumen[]>('/resumenes');
}

export async function getFlashcards(): Promise<Flashcard[]> {
  return fetchJson<Flashcard[]>('/flashcards');
}

export async function getResultados(perfilCodigo?: string): Promise<Resultado[]> {
  if (perfilCodigo) {
    const res = await fetch(`/api/resultados?perfil_codigo=${encodeURIComponent(perfilCodigo)}`);
    if (!res.ok) throw new Error(`Error cargando resultados: ${res.status}`);
    const data = await res.json();
    return (data.resultados ?? []) as Resultado[];
  }
  return fetchJson<Resultado[]>('/resultados');
}

const PERFIL_KEY = 'perfil_codigo';

export function getPerfilActivo(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PERFIL_KEY);
}

export function setPerfilActivo(codigo: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PERFIL_KEY, codigo);
}

export function clearPerfilActivo() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PERFIL_KEY);
}
