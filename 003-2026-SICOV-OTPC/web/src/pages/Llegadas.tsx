import { useMemo, useState } from 'react'
import { PageHeader, EstadoBadge } from '@/ui/components'
import { Ic } from '@/ui/icons'
import { llegadas as demo, type Llegada } from '@/data/demo'
import { api, useRecurso } from '@/api/client'

export default function Llegadas() {
  const [q, setQ] = useState('')
  const { data } = useRecurso<Llegada[]>(api.llegadas, demo)
  const rows = useMemo(() => data.filter((l) => q === '' || `${l.placa} ${l.empresa} ${l.id}`.toLowerCase().includes(q.toLowerCase())), [q, data])

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Llegadas"
        desc="Registro de llegadas a terminal con la misma cola de estados y reintentos."
        actions={<button className="btn btn-primary"><Ic.plus width={16} height={16} /> Registrar llegada</button>}
      />

      <div className="toolbar">
        <div className="input-group" style={{ maxWidth: 300 }}>
          <span className="ig-icon"><Ic.search width={16} height={16} /></span>
          <input className="input" placeholder="Buscar placa, empresa, ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>ID</th><th>Placa</th><th>Empresa</th><th>Tipo llegada</th><th>Terminal</th><th>Hora</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="mono" style={{ color: 'var(--text-hi)' }}>{l.id}</td>
                  <td><span className="badge badge-neutral mono">{l.placa}</span></td>
                  <td className="muted">{l.empresa}</td>
                  <td>{l.tipoLlegada}</td>
                  <td className="muted"><span className="row gap-6"><Ic.pin width={14} height={14} /> {l.terminal}</span></td>
                  <td className="mono dim">{l.fechaHora.split(' ')[1]}</td>
                  <td><EstadoBadge estado={l.estado} /></td>
                  <td><button className="btn btn-ghost btn-sm">Detalle</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
