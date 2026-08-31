import { PruebasJelkin, claseTag, mostrar } from "@/lib/bi/operacion";

interface Props {
    p?: PruebasJelkin | null;
}

function Fecha({ v }: { v?: string | null }) {
    if (v == null || v === "") return <span className="dash">—</span>;
    return <span className="d">{v}</span>;
}

function TagEstado({ v }: { v?: string | null }) {
    const c = claseTag(v);
    if (c === null) return <span className="dash">—</span>;
    return <span className={`tag ${c}`}>{v}</span>;
}

export function TablaPruebasJelkin({ p }: Props) {
    // Orden de filas = orden del array (NO reordenar · contrato §7).
    const filas = p?.filas ?? [];
    // Degradación (candado 9): array ausente o vacío → el bloque no se pinta.
    if (filas.length === 0) return null;

    return (
        <div className="panel">
            <div className="ph">
                <h2>Pruebas de Jelkin</h2>
                {p?.resumen ? <span className="meta">{p.resumen}</span> : null}
            </div>
            <div className="scroll">
                <table>
                    <thead>
                        <tr>
                            <th className="c">#</th>
                            <th>Prueba</th>
                            <th className="c">Fecha</th>
                            <th>Hallazgos</th>
                            <th className="c">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map((row, i) => (
                            <tr key={row.id || i}>
                                <td className="c id">{mostrar(row.id)}</td>
                                <td className="nm">{mostrar(row.prueba)}</td>
                                <td className="c">
                                    <Fecha v={row.fecha} />
                                </td>
                                <td>{mostrar(row.hallazgos)}</td>
                                <td className="c">
                                    <TagEstado v={row.estado} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
