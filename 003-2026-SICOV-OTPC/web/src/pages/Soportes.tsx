import { PageHeader, Badge } from '@/ui/components'
import { Ic } from '@/ui/icons'
import { soportes as demo, type Soporte } from '@/data/demo'
import { api, useRecurso } from '@/api/client'

const estado: Record<string, { tone: 'ok' | 'warn' | 'info' | 'neutral'; txt: string }> = {
  abierto: { tone: 'warn', txt: 'Abierto' },
  respondido: { tone: 'info', txt: 'Respondido' },
  cerrado: { tone: 'neutral', txt: 'Cerrado' },
}

export default function Soportes() {
  const { data } = useRecurso<Soporte[]>(api.soportes, demo)
  return (
    <>
      <PageHeader
        eyebrow="Cumplimiento"
        title="Soportes"
        desc="Casos de soporte con adjuntos, respuesta y notificación por correo."
        actions={<button className="btn btn-primary"><Ic.plus width={16} height={16} /> Nuevo caso</button>}
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { l: 'Abiertos', v: data.filter((s) => s.estado === 'abierto').length, c: 'var(--warn)' },
          { l: 'Respondidos', v: data.filter((s) => s.estado === 'respondido').length, c: 'var(--info)' },
          { l: 'Cerrados', v: data.filter((s) => s.estado === 'cerrado').length, c: 'var(--text-lo)' },
        ].map((s) => (
          <div key={s.l} className="card card-pad row between">
            <span className="muted">{s.l}</span>
            <span className="kpi-val" style={{ fontSize: 24, color: s.c }}>{s.v}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>ID</th><th>Asunto</th><th>Motivo</th><th>Empresa</th><th>Creado</th><th>Adjuntos</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="mono" style={{ color: 'var(--text-hi)' }}>{s.id}</td>
                  <td style={{ color: 'var(--text-hi)' }}>{s.asunto}</td>
                  <td className="muted">{s.motivo}</td>
                  <td className="muted">{s.empresa}</td>
                  <td className="mono dim">{s.creado}</td>
                  <td><span className="row gap-6 mono"><Ic.file width={14} height={14} /> {s.adjuntos}</span></td>
                  <td><Badge tone={estado[s.estado].tone}><span className="dot" />{estado[s.estado].txt}</Badge></td>
                  <td><button className="btn btn-ghost btn-sm">Responder</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
