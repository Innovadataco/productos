import { useMemo, useState } from 'react'
import { PageHeader, Badge } from '@/ui/components'
import { Ic } from '@/ui/icons'
import { novedades as demo, type CategoriaNovedad, type Novedad } from '@/data/demo'
import { api, useRecurso } from '@/api/client'

const sev: Record<string, { tone: 'ok' | 'warn' | 'danger'; txt: string }> = {
  ok: { tone: 'ok', txt: 'Al día' },
  porVencer: { tone: 'warn', txt: 'Por vencer' },
  vencido: { tone: 'danger', txt: 'Vencido' },
}

export default function Novedades() {
  const [cat, setCat] = useState<CategoriaNovedad | 'Todas'>('Todas')
  const { data } = useRecurso<Novedad[]>(() => api.novedades(), demo)
  const rows = useMemo(() => data.filter((n) => cat === 'Todas' || n.categoria === cat), [cat, data])

  return (
    <>
      <PageHeader
        eyebrow="Cumplimiento"
        title="Novedades"
        desc="Vigencias de documentos por vehículo y conductor (SOAT, RTM, licencias, alcoholimetría…)."
        actions={<button className="btn btn-primary"><Ic.plus width={16} height={16} /> Nueva novedad</button>}
      />

      <div className="toolbar">
        {(['Todas', 'Vehículo', 'Conductor'] as const).map((c) => (
          <button key={c} className={`chip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>ID</th><th>Categoría</th><th>Placa</th><th>Documento</th><th>N.º</th><th>Vence</th><th>Estado</th></tr></thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td className="mono" style={{ color: 'var(--text-hi)' }}>{n.id}</td>
                  <td><span className="row gap-6">{n.categoria === 'Vehículo' ? <Ic.truck width={15} height={15} /> : <Ic.users width={15} height={15} />} {n.categoria}</span></td>
                  <td><span className="badge badge-neutral mono">{n.placa}</span></td>
                  <td style={{ color: 'var(--text-hi)' }}>{n.detalle}</td>
                  <td className="mono dim">{n.documento}</td>
                  <td className="mono">{n.vence}</td>
                  <td><Badge tone={sev[n.severidad].tone}><span className="dot" />{sev[n.severidad].txt}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
