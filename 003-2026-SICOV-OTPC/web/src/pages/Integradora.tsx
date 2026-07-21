import { useState } from 'react'
import { PageHeader, Badge } from '@/ui/components'
import { Ic } from '@/ui/icons'
import { empresas } from '@/data/demo'
import { api } from '@/api/client'

export default function Integradora() {
  const [placa, setPlaca] = useState('SVL482')
  const [consultado, setConsultado] = useState(false)
  const [resumen, setResumen] = useState<any>(null)

  const consultar = async () => {
    try { setResumen(await api.integradora(placa)) } catch { setResumen(null) }
    setConsultado(true)
  }

  return (
    <>
      <PageHeader
        eyebrow="Integración"
        title="Integradora"
        desc="Consulta el resumen consolidado de un vehículo contra la API integradora de Supertransporte."
      />

      <div className="grid" style={{ gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card card-pad col gap-16">
          <span className="h2">Parámetros de consulta</span>
          <div className="field">
            <label className="label">Placa</label>
            <div className="input-group"><span className="ig-icon"><Ic.truck width={17} height={17} /></span>
              <input className="input mono" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} /></div>
          </div>
          <div className="field">
            <label className="label">Empresa (NIT)</label>
            <select className="select">{empresas.map((e) => <option key={e.nit}>{e.nombre} · {e.nit}</option>)}</select>
          </div>
          <div className="field">
            <label className="label">Fecha</label>
            <input className="input" type="date" defaultValue="2026-07-21" />
          </div>
          <button className="btn btn-primary" onClick={consultar}><Ic.link width={16} height={16} /> Consultar resumen</button>
          <div className="hint">La consulta se realiza tras la interfaz de integración. En demo se devuelve un resumen simulado.</div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="h2">Resumen · {placa}</span>
            {consultado && <Badge tone="ok"><span className="dot" /> Respuesta 200 · integradora</Badge>}
          </div>
          <div className="card-pad">
            {!consultado ? (
              <div className="col center" style={{ padding: '50px 20px', textAlign: 'center', gap: 8 }}>
                <div className="feat-ic" style={{ width: 46, height: 46 }}><Ic.link width={22} height={22} /></div>
                <div style={{ color: 'var(--text-hi)', fontWeight: 600 }}>Sin consulta</div>
                <div className="muted" style={{ fontSize: 13 }}>Ingresa una placa y presiona “Consultar resumen”.</div>
              </div>
            ) : (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {[
                  { l: 'Nivel de servicio', v: resumen?.nivelServicio ?? 'Intermunicipal', ic: 'route' as const },
                  { l: 'Despachos (mes)', v: String(resumen?.despachosMes ?? 42), ic: 'truck' as const },
                  { l: 'Llegadas (mes)', v: String(resumen?.llegadasMes ?? 39), ic: 'inbox' as const },
                  { l: 'Novedades activas', v: `${resumen?.novedadesActivas ?? 1} · SOAT por vencer`, ic: 'alert' as const },
                  { l: 'Mantenimientos', v: `${resumen?.mantenimientos ?? 6} registrados`, ic: 'wrench' as const },
                  { l: 'Estado vigilado', v: resumen?.estadoVigilado ?? 'Contrato vigente', ic: 'shield' as const },
                ].map((c) => {
                  const I = Ic[c.ic]
                  return (
                    <div key={c.l} className="card card-pad" style={{ background: 'var(--surface)' }}>
                      <div className="row gap-8 dim" style={{ marginBottom: 8 }}><I width={16} height={16} /><span style={{ fontSize: 12.5 }}>{c.l}</span></div>
                      <div style={{ fontSize: 16, fontWeight: 650, color: 'var(--text-hi)' }}>{c.v}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
