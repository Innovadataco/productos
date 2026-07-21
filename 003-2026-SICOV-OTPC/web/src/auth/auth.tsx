import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, tokenStore } from '@/api/client'

export interface Sesion {
  identificacion: string
  usuario: string
  nombre: string
  rol: 'administrador' | 'cliente' | 'operador'
  rolId: number
  empresa?: string
}

interface AuthCtx {
  sesion: Sesion | null
  login: (usuario: string, clave: string, modo: 'interno' | 'vigia') => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)
const KEY = 'gesmovil:sesion'

// Usuarios demo. En producción esto lo resuelve /api/v1/autenticacion/inicio-sesion
const usuariosDemo: Record<string, Sesion & { clave: string }> = {
  admin: { identificacion: '1032456789', usuario: 'admin', clave: 'admin', nombre: 'Camila Restrepo', rol: 'administrador', rolId: 1 },
  operador: { identificacion: '1088990011', usuario: 'operador', clave: 'operador', nombre: 'Andrés Villa', rol: 'operador', rolId: 3 },
  cliente: { identificacion: '900853057', usuario: 'cliente', clave: 'cliente', nombre: 'Transportes Andinos', rol: 'cliente', rolId: 2, empresa: 'Transportes Andinos S.A.' },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Sesion) : null
  })

  useEffect(() => {
    if (sesion) localStorage.setItem(KEY, JSON.stringify(sesion))
    else localStorage.removeItem(KEY)
  }, [sesion])

  const login: AuthCtx['login'] = async (usuario, clave, modo) => {
    // 1) Intenta el backend real (NestJS).
    try {
      const r = modo === 'vigia' ? await api.loginVigia(usuario) : await api.login(usuario, clave)
      tokenStore.set(r.token)
      setSesion({
        identificacion: String(r.usuario.id), usuario: r.usuario.usuario, nombre: r.usuario.nombre,
        rol: r.usuario.rol as Sesion['rol'], rolId: r.usuario.rolId, empresa: r.usuario.empresa ?? undefined,
      })
      return
    } catch (e) {
      // Si el backend responde y rechaza credenciales, propaga el error.
      if (e instanceof Error && /incorrect|inválid|invalid|Unauthorized/i.test(e.message)) throw new Error('Usuario o clave incorrectos.')
    }
    // 2) Fallback demo (backend no disponible / modo preview).
    await new Promise((r) => setTimeout(r, 300))
    if (modo === 'vigia') {
      setSesion({ identificacion: '900853057', usuario: 'vigia', nombre: 'Sesión Vigía', rol: 'cliente', rolId: 2, empresa: 'Proveedor vigilado' })
      return
    }
    const u = usuariosDemo[usuario.trim().toLowerCase()]
    if (!u || u.clave !== clave) throw new Error('Usuario o clave incorrectos.')
    const { clave: _omit, ...s } = u
    setSesion(s)
  }

  const logout = () => { tokenStore.clear(); setSesion(null) }

  return <Ctx.Provider value={{ sesion, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

export function Protegido({ children, roles }: { children: ReactNode; roles?: number[] }) {
  const { sesion } = useAuth()
  const loc = useLocation()
  if (!sesion) return <Navigate to="/login" state={{ from: loc }} replace />
  if (roles && !roles.includes(sesion.rolId)) return <Navigate to="/app" replace />
  return <>{children}</>
}
