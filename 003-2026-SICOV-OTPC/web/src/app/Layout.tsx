import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Ic, type IconKey } from '@/ui/icons'
import { useAuth } from '@/auth/auth'

interface NavItem { to: string; label: string; icon: IconKey; roles?: number[] }
interface NavGroup { title: string; items: NavItem[] }

const nav: NavGroup[] = [
  {
    title: 'Operación',
    items: [
      { to: '/app', label: 'Dashboard', icon: 'grid' },
      { to: '/app/despachos', label: 'Despachos', icon: 'truck' },
      { to: '/app/llegadas', label: 'Llegadas', icon: 'inbox' },
      { to: '/app/integradora', label: 'Integradora', icon: 'link' },
    ],
  },
  {
    title: 'Cumplimiento',
    items: [
      { to: '/app/mantenimientos', label: 'Mantenimientos', icon: 'wrench' },
      { to: '/app/novedades', label: 'Novedades', icon: 'alert' },
      { to: '/app/soportes', label: 'Soportes', icon: 'ticket' },
    ],
  },
  {
    title: 'Maestras',
    items: [
      { to: '/app/terminales', label: 'Terminales y rutas', icon: 'route' },
      { to: '/app/empresas', label: 'Proveedores vigilados', icon: 'building' },
      { to: '/app/usuarios', label: 'Usuarios y roles', icon: 'users', roles: [1] },
    ],
  },
]

export default function Layout() {
  const { sesion, logout } = useAuth()
  const navigate = useNavigate()
  const iniciales = (sesion?.nombre ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  const salir = () => { logout(); navigate('/login') }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
              <path d="M14 42 L26 18 L32 30 L38 18 L50 42" stroke="var(--amber-500)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="32" cy="47" r="4" fill="var(--teal-500)" />
            </svg>
          </div>
          <div className="col" style={{ lineHeight: 1.15 }}>
            <span style={{ fontWeight: 750, color: 'var(--text-hi)', letterSpacing: '-0.01em' }}>Gesmovil</span>
            <span className="dim" style={{ fontSize: 11, letterSpacing: '0.04em' }}>Gestión y Control</span>
          </div>
        </div>

        <nav className="nav">
          {nav.map((g) => {
            const items = g.items.filter((it) => !it.roles || it.roles.includes(sesion?.rolId ?? 0))
            if (!items.length) return null
            return (
              <div key={g.title} className="nav-group">
                <div className="nav-title">{g.title}</div>
                {items.map((it) => {
                  const Icon = Ic[it.icon]
                  return (
                    <NavLink key={it.to} to={it.to} end={it.to === '/app'}
                      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                      <Icon width={18} height={18} />
                      <span>{it.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="user-card">
            <div className="avatar">{iniciales}</div>
            <div className="col" style={{ minWidth: 0, lineHeight: 1.25 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sesion?.nombre}</span>
              <span className="dim" style={{ fontSize: 11, textTransform: 'capitalize' }}>{sesion?.rol}</span>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" title="Cerrar sesión" onClick={salir} style={{ marginLeft: 'auto' }}>
              <Ic.logout width={17} height={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="input-group" style={{ maxWidth: 380, width: '100%' }}>
            <span className="ig-icon"><Ic.search width={17} height={17} /></span>
            <input className="input" placeholder="Buscar placa, despacho, empresa…" />
          </div>
          <div className="row gap-10" style={{ marginLeft: 'auto' }}>
            <button className="btn btn-ghost btn-icon" title="Notificaciones"><Ic.bell width={19} height={19} /></button>
            <div className="env-pill"><span className="dot-live" /> Entorno demo</div>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}
