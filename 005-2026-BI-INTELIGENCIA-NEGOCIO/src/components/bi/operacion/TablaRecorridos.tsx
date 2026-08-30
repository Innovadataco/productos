import {
    Recorridos,
    RecorridoFila,
    claseTag,
    anchoBarra,
    mostrar,
} from "@/lib/bi/operacion";

interface Props {
    r?: Recorridos | null;
}

function Fecha({ v, est = false }: { v?: string | null; est?: boolean }) {
    if (v == null || v === "") return <span className="dash">—</span>;
    return <span className={est ? "d est" : "d"}>{v}</span>;
}

function TagResultado({ v }: { v?: string | null }) {
    const c = claseTag(v);
    if (c === null) return <span className="dash">—</span>;
    return <span className={`tag ${c}`}>{v}</span>;
}

function Avance({ row }: { row: RecorridoFila }) {
    const a = row.avance;
    if (!a) return <span className="dash">—</span>;
    const pct = anchoBarra(a);
    const hechos = typeof a.hechos === "number" ? a.hechos : 0;
    const total = typeof a.total === "number" ? a.total : 0;
    return (
        <span className="prog">
            <span className="track">
                <i style={{ width: `${pct}%` }} />
            </span>
            <span className="ref">
                {hechos}/{total}
            </span>
        </span>
    );
}

function TeNecesita({ row }: { row: RecorridoFila }) {
    const t = row.teNecesita;
    if (!t || !t.necesita) return <span className="dash">No</span>;
    const clase = t.critico ? "need hard" : "need";
    return <span className={clase}>Sí · {mostrar(t.pasos)}</span>;
}

export function TablaRecorridos({ r }: Props) {
    // Orden de filas = orden del array (NO reordenar · contrato §3).
    const filas = r?.filas ?? [];

    return (
        <div className="panel">
            <div className="ph">
                <h2>Recorridos de calidad</h2>
                {r?.resumen ? <span className="meta">{r.resumen}</span> : null}
            </div>
            <div className="scroll">
                <table>
                    <thead>
                        <tr>
                            <th className="c">#</th>
                            <th>Recorrido</th>
                            <th className="c">Avance</th>
                            <th className="c">Inicio</th>
                            <th className="c">Estimada</th>
                            <th className="c">Fin</th>
                            <th className="c">Resultado</th>
                            <th className="c">Estado</th>
                            <th>¿Te necesita?</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas.length === 0 ? (
                            <tr>
                                <td className="c dash" colSpan={9}>
                                    Sin datos
                                </td>
                            </tr>
                        ) : (
                            filas.map((row, i) => (
                                <tr key={row.id || i}>
                                    <td className="c id">{mostrar(row.id)}</td>
                                    <td className="nm">{mostrar(row.nombre)}</td>
                                    <td className="c">
                                        <Avance row={row} />
                                    </td>
                                    <td className="c">
                                        <Fecha v={row.inicio} />
                                    </td>
                                    <td className="c">
                                        <Fecha v={row.estimada} est />
                                    </td>
                                    <td className="c">
                                        <Fecha v={row.fin} />
                                    </td>
                                    <td className="c">
                                        <TagResultado v={row.resultado} />
                                    </td>
                                    <td className="c d">{mostrar(row.estado)}</td>
                                    <td>
                                        <TeNecesita row={row} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
