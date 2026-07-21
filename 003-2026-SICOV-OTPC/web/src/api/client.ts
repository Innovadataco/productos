// Cliente HTTP tipado hacia la API NestJS (proxy /api -> :5050).
// Si el backend no responde, las páginas caen a los datos demo locales.

const BASE = '/api/v1'
const TOKEN_KEY = 'gesmovil:token'

// ISO -> "YYYY-MM-DD HH:mm" / "YYYY-MM-DD" (formato que espera la UI)
const p2 = (n: number) => String(n).padStart(2, '0')
const fechaHora = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}
const fecha = (iso: string) => fechaHora(iso).split(' ')[0]

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}))
    throw new Error((msg as { message?: string }).message ?? `HTTP ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export interface LoginResp {
  token: string
  usuario: { id: number; usuario: string; nombre: string; rol: string; rolId: number; empresa: string | null }
}

export const api = {
  login: (usuario: string, clave: string) =>
    req<LoginResp>('/autenticacion/inicio-sesion', { method: 'POST', body: JSON.stringify({ usuario, clave }) }),
  loginVigia: (token: string) =>
    req<LoginResp>('/autenticacion/inicio-vigia', { method: 'POST', body: JSON.stringify({ token }) }),

  dashboard: () => req<any>('/dashboard'),
  logs: () => req<any[]>('/dashboard/logs'),
  despachos: () => req<any[]>('/despachos').then((r) => r.map((d) => ({ ...d, fechaHora: fechaHora(d.fechaHora) }))),
  reintentarDespacho: (id: number) => req<any>(`/despachos/${id}/reintentar`, { method: 'POST' }),
  llegadas: () => req<any[]>('/llegadas').then((r) => r.map((l) => ({ ...l, fechaHora: fechaHora(l.fechaHora) }))),
  mantenimientos: (tipo?: string) => req<any[]>(`/mantenimiento/historial${tipo ? `?tipo=${encodeURIComponent(tipo)}` : ''}`).then((r) => r.map((m) => ({ ...m, fecha: fecha(m.fecha) }))),
  novedades: (categoria?: string) => req<any[]>(`/novedades${categoria ? `?categoria=${encodeURIComponent(categoria)}` : ''}`).then((r) => r.map((n) => ({ ...n, vence: fecha(n.vence) }))),
  soportes: () => req<any[]>('/soportes'),
  empresas: () => req<any[]>('/empresas'),
  rutas: () => req<any[]>('/terminales/rutas'),
  usuarios: () => req<any[]>('/usuarios'),
  integradora: (placa: string) => req<any>(`/integracion/integradora/resumen/${placa}`),
}

// Hook simple: intenta la API y cae a datos demo si falla (modo offline/preview).
import { useEffect, useState } from 'react'
export function useRecurso<T>(fn: () => Promise<T>, fallback: T): { data: T; live: boolean; cargando: boolean } {
  const [data, setData] = useState<T>(fallback)
  const [live, setLive] = useState(false)
  const [cargando, setCargando] = useState(true)
  useEffect(() => {
    let vivo = true
    fn()
      .then((d) => { if (vivo) { setData(d); setLive(true) } })
      .catch(() => { if (vivo) setLive(false) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { data, live, cargando }
}
