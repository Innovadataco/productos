import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/auth'
import { Ic } from '@/ui/icons'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [modo, setModo] = useState<'interno' | 'vigia'>('interno')
  const [usuario, setUsuario] = useState('admin')
  const [clave, setClave] = useState('admin')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setCargando(true)
    try {
      await login(modo === 'vigia' ? token : usuario, clave, modo)
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="auth-wrap">
      <aside className="auth-aside">
        <div className="auth-grid-bg" />
        <div className="row gap-12" style={{ position: 'relative', zIndex: 1 }}>
          <div className="brand-mark" style={{ width: 44, height: 44 }}>
            <svg width="26" height="26" viewBox="0 0 64 64" fill="none">
              <path d="M14 42 L26 18 L32 30 L38 18 L50 42" stroke="var(--amber-500)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="32" cy="47" r="4" fill="var(--teal-500)" />
            </svg>
          </div>
          <div className="col" style={{ lineHeight: 1.15 }}>
            <span style={{ fontWeight: 800, fontSize: 19, color: 'var(--text-hi)' }}>Gesmovil</span>
            <span className="dim" style={{ fontSize: 12 }}>Plataforma de Gestión y Control</span>
          </div>
        </div>

        <div className="col gap-20" style={{ position: 'relative', zIndex: 1, maxWidth: 440 }}>
          <h2 style={{ fontSize: 30, fontWeight: 750, letterSpacing: '-0.02em', color: 'var(--text-hi)', lineHeight: 1.15, margin: 0 }}>
            Despachos, llegadas y cumplimiento <span style={{ color: 'var(--amber-400)' }}>en un solo lugar</span>.
          </h2>
          <div className="col gap-16">
            {[
              { ic: Ic.truck, t: 'Despachos y llegadas', d: 'Colas con estados y reintentos automáticos hacia Supertransporte.' },
              { ic: Ic.wrench, t: 'Mantenimientos', d: 'Preventivo, correctivo y alistamiento con carga masiva por Excel.' },
              { ic: Ic.shield, t: 'Proveedores vigilados', d: 'Acceso tokenizado y validación por contrato vigente.' },
            ].map((f, i) => {
              const I = f.ic
              return (
                <div className="feat" key={i}>
                  <div className="feat-ic"><I width={18} height={18} /></div>
                  <div className="col" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 650, color: 'var(--text-hi)', fontSize: 14 }}>{f.t}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{f.d}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="dim" style={{ position: 'relative', zIndex: 1, fontSize: 12 }}>
          © 2026 Innovadata · Rediseño arquitectónico
        </div>
      </aside>

      <div className="auth-main">
        <div className="auth-card">
          <div className="col gap-6" style={{ marginBottom: 24 }}>
            <span className="eyebrow">Bienvenido</span>
            <h1 className="h1">Iniciar sesión</h1>
            <span className="muted" style={{ fontSize: 14 }}>Ingresa con tus credenciales o token Vigía.</span>
          </div>

          <div className="seg">
            <button className={modo === 'interno' ? 'on' : ''} onClick={() => { setModo('interno'); setError('') }}>Interno</button>
            <button className={modo === 'vigia' ? 'on' : ''} onClick={() => { setModo('vigia'); setError('') }}>Vigía</button>
          </div>

          <form className="col gap-16" onSubmit={enviar}>
            {modo === 'interno' ? (
              <>
                <div className="field">
                  <label className="label">Usuario o documento</label>
                  <div className="input-group">
                    <span className="ig-icon"><Ic.users width={17} height={17} /></span>
                    <input className="input" value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="admin" autoComplete="username" />
                  </div>
                </div>
                <div className="field">
                  <label className="label">Contraseña</label>
                  <div className="input-group">
                    <span className="ig-icon"><Ic.shield width={17} height={17} /></span>
                    <input className="input" type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                  </div>
                </div>
              </>
            ) : (
              <div className="field">
                <label className="label">Token Vigía</label>
                <div className="input-group">
                  <span className="ig-icon"><Ic.link width={17} height={17} /></span>
                  <input className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pega aquí el token de Vigía" />
                </div>
              </div>
            )}

            {error && <div className="auth-err">{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={cargando} style={{ height: 44 }}>
              {cargando ? 'Verificando…' : 'Entrar'} {!cargando && <Ic.chevron width={17} height={17} />}
            </button>

            <div className="hint">
              <strong style={{ color: 'var(--text-lo)' }}>Demo:</strong> admin/admin · operador/operador · cliente/cliente
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
