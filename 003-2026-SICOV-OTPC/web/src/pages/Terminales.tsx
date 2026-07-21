import { PageHeader, Badge } from '@/ui/components'
import { Ic } from '@/ui/icons'
import { api, useRecurso } from '@/api/client'

interface RutaRow { codigo: string; ruta: string; empresa: string; paradas: number; clase: string; habilitada: boolean }

const rutasDemo: RutaRow[] = [
  { codigo: 'RT-1042', ruta: 'Bogotá – Ibagué', empresa: 'Transportes Andinos S.A.', paradas: 6, clase: 'Intermunicipal', habilitada: true },
  { codigo: 'RT-1055', ruta: 'Cali – Popayán', empresa: 'Coomotor Cooperativa', paradas: 4, clase: 'Intermunicipal', habilitada: true },
  { codigo: 'RT-1071', ruta: 'Medellín – Montería', empresa: 'Transportes Andinos S.A.', paradas: 9, clase: 'Larga distancia', habilitada: true },
  { codigo: 'RT-1088', ruta: 'Bucaramanga – Cúcuta', empresa: 'Expreso Bolivariano', paradas: 5, clase: 'Intermunicipal', habilitada: false },
  { codigo: 'RT-1093', ruta: 'Neiva – Bogotá', empresa: 'Flota La Macarena Ltda.', paradas: 7, clase: 'Larga distancia', habilitada: true },
]

export default function Terminales() {
  const { data: rutas } = useRecurso<RutaRow[]>(api.rutas, rutasDemo)
  return (
    <>
      <PageHeader
        eyebrow="Maestras"
        title="Terminales y rutas"
        desc="Rutas habilitadas por empresa, paradas, clases de vehículo y vías."
        actions={<>
          <button className="btn"><Ic.pin width={16} height={16} /> Nueva parada</button>
          <button className="btn btn-primary"><Ic.plus width={16} height={16} /> Guardar ruta</button>
        </>}
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { l: 'Rutas totales', v: 34, ic: 'route' as const, c: 'var(--amber-500)' },
          { l: 'Habilitadas', v: 29, ic: 'check' as const, c: 'var(--ok)' },
          { l: 'Terminales', v: 12, ic: 'building' as const, c: 'var(--teal-500)' },
          { l: 'Paradas', v: 148, ic: 'pin' as const, c: 'var(--info)' },
        ].map((k) => {
          const I = Ic[k.ic]
          return (
            <div key={k.l} className="kpi">
              <div className="kpi-ic" style={{ background: `color-mix(in srgb, ${k.c} 16%, transparent)`, color: k.c }}><I width={19} height={19} /></div>
              <div className="kpi-val">{k.v}</div>
              <div className="kpi-label">{k.l}</div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-head"><span className="h2">Rutas habilitadas</span></div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Código</th><th>Ruta</th><th>Empresa</th><th>Paradas</th><th>Clase</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {rutas.map((r) => (
                <tr key={r.codigo}>
                  <td className="mono" style={{ color: 'var(--text-hi)' }}>{r.codigo}</td>
                  <td><span className="row gap-8"><Ic.route width={15} height={15} /> {r.ruta}</span></td>
                  <td className="muted">{r.empresa}</td>
                  <td className="mono">{r.paradas}</td>
                  <td><Badge tone="neutral">{r.clase}</Badge></td>
                  <td>{r.habilitada ? <Badge tone="ok"><span className="dot" />Habilitada</Badge> : <Badge tone="neutral"><span className="dot" />Inactiva</Badge>}</td>
                  <td><button className="btn btn-ghost btn-sm">Ver paradas</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
