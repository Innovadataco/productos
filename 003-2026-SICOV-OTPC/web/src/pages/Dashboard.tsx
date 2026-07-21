import { PageHeader, Donut, Sparkline, Bars, EstadoBadge, Badge } from '@/ui/components'
import { Ic } from '@/ui/icons'
import { kpis as kpisDemo, serieDespachos, estadoCola as colaDemo, despachos as despDemo, logsRecientes, novedades, type Despacho } from '@/data/demo'
import { api, useRecurso } from '@/api/client'
import { useAuth } from '@/auth/auth'

function Kpi({ icon, tint, val, label, spark, sparkColor }: { icon: keyof typeof Ic; tint: string; val: string | number; label: string; spark?: number[]; sparkColor?: string }) {
  const I = Ic[icon]
  return (
    <div className="kpi">
      <div className="kpi-ic" style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)`, color: tint }}><I width={19} height={19} /></div>
      <div className="kpi-val">{val}</div>
      <div className="kpi-label">{label}</div>
      {spark && <div className="kpi-trend"><Sparkline values={spark} color={sparkColor ?? tint} w={70} h={30} /></div>}
    </div>
  )
}

export default function Dashboard() {
  const { sesion } = useAuth()
  const { data: kpis } = useRecurso<typeof kpisDemo & { estadoCola?: typeof colaDemo }>(api.dashboard, kpisDemo)
  const { data: despachos } = useRecurso<Despacho[]>(api.despachos, despDemo)
  const { data: logs } = useRecurso(api.logs, logsRecientes.map((l) => ({ hora: l.hora, nivel: l.nivel, mensaje: l.msg })))
  const estadoCola = kpis.estadoCola ?? colaDemo
  const nivelOk = kpis.despachosHoy ? Math.round((kpis.despachosOk / kpis.despachosHoy) * 100) : 0

  return (
    <>
      <PageHeader
        eyebrow={`Hola, ${sesion?.nombre?.split(' ')[0]}`}
        title="Panel de control"
        desc="Resumen operativo de la jornada · 21 jul 2026"
        actions={<>
          <button className="btn"><Ic.refresh width={16} height={16} /> Actualizar</button>
          <button className="btn btn-primary"><Ic.download width={16} height={16} /> Exportar informe</button>
        </>}
      />

      <div className="kpi-grid">
        <Kpi icon="truck" tint="var(--amber-500)" val={kpis.despachosHoy} label="Despachos hoy" spark={serieDespachos} />
        <Kpi icon="check" tint="var(--ok)" val={`${nivelOk}%`} label="Nivel de éxito de envío" spark={serieDespachos.map((v) => v * 0.92)} sparkColor="var(--ok)" />
        <Kpi icon="clock" tint="var(--info)" val={kpis.enCola} label="Solicitudes en cola" />
        <Kpi icon="alert" tint="var(--danger)" val={kpis.vencidos} label="Documentos vencidos" />
      </div>

      <div className="grid mt-24" style={{ gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <div className="col gap-4">
              <span className="h2">Despachos procesados</span>
              <span className="muted" style={{ fontSize: 12.5 }}>Últimas 14 jornadas</span>
            </div>
            <Badge tone="ok"><span className="dot" /> +8.4% vs. semana previa</Badge>
          </div>
          <div className="card-pad">
            <Bars values={serieDespachos} h={150} />
            <div className="row between mt-16" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
              <span>8 jul</span><span>14 jul</span><span>21 jul</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="h2">Estado de la cola</span></div>
          <div className="card-pad row center" style={{ padding: '26px 20px' }}>
            <Donut data={estadoCola} />
          </div>
        </div>
      </div>

      <div className="grid mt-24" style={{ gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <span className="h2">Últimos despachos</span>
            <a className="btn btn-ghost btn-sm" href="/app/despachos">Ver todos <Ic.chevron width={15} height={15} /></a>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>ID</th><th>Placa</th><th>Empresa</th><th>Hora</th><th>Estado</th></tr></thead>
              <tbody>
                {despachos.slice(0, 5).map((d) => (
                  <tr key={d.id}>
                    <td className="mono" style={{ color: 'var(--text-hi)' }}>{d.id}</td>
                    <td><span className="badge badge-neutral mono">{d.placa}</span></td>
                    <td className="muted">{d.empresa}</td>
                    <td className="mono dim">{d.fechaHora.split(' ')[1]}</td>
                    <td><EstadoBadge estado={d.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col gap-16">
          <div className="card card-pad">
            <div className="row between" style={{ marginBottom: 14 }}>
              <span className="h2">Cumplimiento documental</span>
            </div>
            <div className="col gap-12">
              {[
                { l: 'Al día', v: novedades.filter((n) => n.severidad === 'ok').length, c: 'var(--ok)', t: novedades.length },
                { l: 'Por vencer', v: novedades.filter((n) => n.severidad === 'porVencer').length, c: 'var(--warn)', t: novedades.length },
                { l: 'Vencidos', v: novedades.filter((n) => n.severidad === 'vencido').length, c: 'var(--danger)', t: novedades.length },
              ].map((r) => (
                <div key={r.l} className="col gap-6">
                  <div className="row between" style={{ fontSize: 13 }}>
                    <span className="muted">{r.l}</span>
                    <span className="mono" style={{ color: 'var(--text-hi)' }}>{r.v}</span>
                  </div>
                  <div className="meter"><span style={{ width: `${(r.v / r.t) * 100}%`, background: r.c }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><span className="h2">Actividad de colas</span></div>
            <div className="col" style={{ padding: '6px 0' }}>
              {logs.map((l: any, i: number) => {
                const hora = l.hora ?? (l.creadoEn ? new Date(l.creadoEn).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '')
                const texto = l.mensaje ?? l.msg
                return (
                  <div key={i} className="row gap-10" style={{ padding: '10px 20px', borderBottom: i < logs.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <span className="mono dim" style={{ fontSize: 12 }}>{hora}</span>
                    <span className={`badge badge-${l.nivel === 'error' ? 'danger' : l.nivel === 'warn' ? 'warn' : 'info'}`} style={{ textTransform: 'uppercase', fontSize: 10 }}>{l.nivel}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{texto}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
