import { PageHeader, Badge } from '@/ui/components'
import { Ic } from '@/ui/icons'
import { empresas as base } from '@/data/demo'
import { api, useRecurso } from '@/api/client'

interface EmpresaRow { nit: string; nombre: string; token: string; vigenteHasta: string; activo: boolean }

const demo: EmpresaRow[] = base.map((e, i) => ({
  ...e,
  token: ['a1f9-88c2-4de1', 'b7c3-1290-9aa4', 'c2e8-4471-0bf6', 'd9a1-6632-77cd', 'e5b4-9981-22ea'][i],
  vigenteHasta: ['2026-12-31', '2026-09-15', '2026-07-10', '2027-01-20', '2026-11-05'][i],
  activo: i !== 2,
}))

const fecha = (v: string) => (v?.includes('T') ? v.split('T')[0] : v)

export default function Empresas() {
  const { data } = useRecurso<EmpresaRow[]>(api.empresas, demo)
  return (
    <>
      <PageHeader
        eyebrow="Maestras"
        title="Proveedores vigilados"
        desc="Empresas habilitadas, con token de acceso por asignación y vigencia de contrato."
        actions={<button className="btn btn-primary"><Ic.plus width={16} height={16} /> Asignar empresa</button>}
      />
      <div className="card">
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Empresa</th><th>NIT</th><th>Token de acceso</th><th>Vigencia contrato</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.nit}>
                  <td><span className="row gap-8"><span className="feat-ic" style={{ width: 30, height: 30, color: 'var(--teal-400)' }}><Ic.building width={15} height={15} /></span><span style={{ color: 'var(--text-hi)', fontWeight: 550 }}>{e.nombre}</span></span></td>
                  <td className="mono">{e.nit}</td>
                  <td className="mono dim">••••-{String(e.token).slice(-4)}</td>
                  <td className="mono">{fecha(e.vigenteHasta)}</td>
                  <td>{e.activo ? <Badge tone="ok"><span className="dot" />Vigente</Badge> : <Badge tone="danger"><span className="dot" />Vencido</Badge>}</td>
                  <td className="row gap-6"><button className="btn btn-ghost btn-sm">Editar</button><button className="btn btn-ghost btn-sm">Rotar token</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
