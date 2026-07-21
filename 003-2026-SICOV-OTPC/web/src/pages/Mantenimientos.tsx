import { useMemo, useState } from 'react'
import { PageHeader, Badge } from '@/ui/components'
import { Ic } from '@/ui/icons'
import { mantenimientos as demo, type TipoMant, type Mantenimiento } from '@/data/demo'
import { api, useRecurso } from '@/api/client'

const tabs: (TipoMant | 'Todos')[] = ['Todos', 'Preventivo', 'Correctivo', 'Alistamiento', 'Autorización']

const estadoTone: Record<string, 'ok' | 'warn' | 'info' | 'danger' | 'neutral'> = {
  enviado: 'ok', en_cola: 'info', registrado: 'neutral', fallido: 'danger',
}
const estadoTxt: Record<string, string> = { enviado: 'Enviado', en_cola: 'En cola', registrado: 'Registrado', fallido: 'Fallido' }

export default function Mantenimientos() {
  const [tab, setTab] = useState<TipoMant | 'Todos'>('Todos')
  const { data } = useRecurso<Mantenimiento[]>(() => api.mantenimientos(), demo)
  const rows = useMemo(() => data.filter((m) => tab === 'Todos' || m.tipo === tab), [tab, data])

  return (
    <>
      <PageHeader
        eyebrow="Cumplimiento"
        title="Mantenimientos"
        desc="Preventivo, correctivo, alistamiento y autorización — con carga masiva y jobs de envío."
        actions={<>
          <button className="btn"><Ic.download width={16} height={16} /> Plantilla</button>
          <button className="btn"><Ic.file width={16} height={16} /> Exportar historial</button>
          <button className="btn btn-primary"><Ic.plus width={16} height={16} /> Registrar</button>
        </>}
      />

      {/* Carga masiva */}
      <div className="card card-pad" style={{ marginBottom: 20, borderStyle: 'dashed', borderColor: 'var(--line-2)', background: 'var(--surface)' }}>
        <div className="row between wrap gap-16">
          <div className="row gap-12">
            <div className="feat-ic" style={{ width: 40, height: 40 }}><Ic.upload width={19} height={19} /></div>
            <div className="col" style={{ gap: 2 }}>
              <span style={{ fontWeight: 650, color: 'var(--text-hi)' }}>Carga masiva por Excel</span>
              <span className="muted" style={{ fontSize: 13 }}>Sube el .xlsx con la plantilla oficial. Se validan columnas y se encolan los jobs.</span>
            </div>
          </div>
          <button className="btn btn-primary"><Ic.upload width={16} height={16} /> Subir archivo</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <div key={t} className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>ID</th><th>Placa</th><th>Empresa</th><th>Tipo</th><th>Descripción</th><th>Fecha</th><th>Responsable</th><th>Estado</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="mono" style={{ color: 'var(--text-hi)' }}>{m.id}</td>
                  <td><span className="badge badge-neutral mono">{m.placa}</span></td>
                  <td className="muted">{m.empresa}</td>
                  <td><Badge tone="info">{m.tipo}</Badge></td>
                  <td>{m.descripcion}</td>
                  <td className="mono dim">{m.fecha}</td>
                  <td className="muted">{m.responsable}</td>
                  <td><Badge tone={estadoTone[m.estado]}><span className="dot" />{estadoTxt[m.estado]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
