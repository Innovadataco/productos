import { useMemo, useState } from 'react'
import { PageHeader, EstadoBadge } from '@/ui/components'
import { Ic } from '@/ui/icons'
import { despachos as demo, type EstadoCola, type Despacho } from '@/data/demo'
import { api, useRecurso } from '@/api/client'

const filtros: { key: EstadoCola | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'procesando', label: 'Procesando' },
  { key: 'procesado', label: 'Procesados' },
  { key: 'fallido', label: 'Fallidos' },
]

export default function Despachos() {
  const [filtro, setFiltro] = useState<EstadoCola | 'todos'>('todos')
  const [q, setQ] = useState('')
  const { data } = useRecurso<Despacho[]>(api.despachos, demo)

  const rows = useMemo(() => data.filter((d) =>
    (filtro === 'todos' || d.estado === filtro) &&
    (q === '' || `${d.placa} ${d.empresa} ${d.id} ${d.nit}`.toLowerCase().includes(q.toLowerCase()))
  ), [filtro, q])

  const conteo = (k: EstadoCola | 'todos') => (k === 'todos' ? data.length : data.filter((d) => d.estado === k).length)

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Despachos"
        desc="Solicitudes de despacho con cola de envío a Supertransporte (reintento cada 5 min)."
        actions={<>
          <button className="btn"><Ic.upload width={16} height={16} /> Importar</button>
          <button className="btn btn-primary"><Ic.plus width={16} height={16} /> Nuevo despacho</button>
        </>}
      />

      <div className="toolbar">
        {filtros.map((f) => (
          <button key={f.key} className={`chip${filtro === f.key ? ' on' : ''}`} onClick={() => setFiltro(f.key)}>
            {f.label} <span className="mono dim">{conteo(f.key)}</span>
          </button>
        ))}
        <div className="input-group" style={{ marginLeft: 'auto', maxWidth: 280 }}>
          <span className="ig-icon"><Ic.search width={16} height={16} /></span>
          <input className="input" placeholder="Buscar placa, NIT, ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>ID</th><th>Placa</th><th>Empresa</th><th>Ruta</th><th>Salida</th><th>Estado</th><th>Reintentos</th><th>Respuesta externa</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="mono" style={{ color: 'var(--text-hi)' }}>{d.id}</td>
                  <td><span className="badge badge-neutral mono">{d.placa}</span></td>
                  <td><div className="col" style={{ gap: 1 }}><span style={{ color: 'var(--text-hi)' }}>{d.empresa}</span><span className="mono dim" style={{ fontSize: 11.5 }}>NIT {d.nit}</span></div></td>
                  <td className="muted">{d.ruta}</td>
                  <td className="mono dim">{d.fechaHora}</td>
                  <td><EstadoBadge estado={d.estado} /></td>
                  <td className="mono" style={{ color: d.reintentos > 0 ? 'var(--warn)' : 'var(--text-dim)' }}>{d.reintentos}/3</td>
                  <td style={{ maxWidth: 220 }}><span className="muted" style={{ fontSize: 12.5 }}>{d.respuesta ?? '—'}</span></td>
                  <td>
                    {d.estado === 'fallido'
                      ? <button className="btn btn-sm"><Ic.refresh width={14} height={14} /> Reintentar</button>
                      : <button className="btn btn-ghost btn-sm">Detalle</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
