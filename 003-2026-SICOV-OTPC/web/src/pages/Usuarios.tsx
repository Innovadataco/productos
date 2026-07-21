import { PageHeader, Badge } from '@/ui/components'
import { Ic } from '@/ui/icons'

const usuarios = [
  { doc: '1032456789', usuario: 'admin', nombre: 'Camila Restrepo', rol: 'Administrador', rolTone: 'ok' as const, modulos: 'Todos', estado: true },
  { doc: '1088990011', usuario: 'avilla', nombre: 'Andrés Villa', rol: 'Operador', rolTone: 'info' as const, modulos: 'Despachos, Llegadas, Mant.', estado: true },
  { doc: '900853057', usuario: 'tandinos', nombre: 'Transportes Andinos', rol: 'Cliente', rolTone: 'warn' as const, modulos: 'Dashboard, Soportes', estado: true },
  { doc: '830001234', usuario: 'macarena', nombre: 'Flota La Macarena', rol: 'Cliente', rolTone: 'warn' as const, modulos: 'Dashboard, Soportes', estado: false },
]

const roles = [
  { nombre: 'Administrador', desc: 'Acceso total a módulos y configuración', usuarios: 1, tone: 'ok' as const },
  { nombre: 'Operador', desc: 'Gestión operativa sin administración de usuarios', usuarios: 4, tone: 'info' as const },
  { nombre: 'Cliente', desc: 'Consulta de sus propios datos como vigilado', usuarios: 12, tone: 'warn' as const },
]

export default function Usuarios() {
  return (
    <>
      <PageHeader
        eyebrow="Maestras"
        title="Usuarios y roles"
        desc="Administración de usuarios, roles base y módulos habilitados por usuario."
        actions={<button className="btn btn-primary"><Ic.plus width={16} height={16} /> Crear usuario</button>}
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {roles.map((r) => (
          <div key={r.nombre} className="card card-pad">
            <div className="row between" style={{ marginBottom: 8 }}>
              <Badge tone={r.tone}>{r.nombre}</Badge>
              <span className="mono muted">{r.usuarios} usuarios</span>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>{r.desc}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head"><span className="h2">Usuarios</span></div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Documento</th><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Módulos</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.doc}>
                  <td className="mono">{u.doc}</td>
                  <td className="mono" style={{ color: 'var(--text-hi)' }}>{u.usuario}</td>
                  <td style={{ color: 'var(--text-hi)' }}>{u.nombre}</td>
                  <td><Badge tone={u.rolTone}>{u.rol}</Badge></td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{u.modulos}</td>
                  <td>{u.estado ? <Badge tone="ok"><span className="dot" />Activo</Badge> : <Badge tone="neutral"><span className="dot" />Inactivo</Badge>}</td>
                  <td><button className="btn btn-ghost btn-sm">Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
