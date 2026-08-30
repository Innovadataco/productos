import { Funcionalidades, claseTag, mostrar } from "@/lib/bi/operacion";

interface Props {
    f?: Funcionalidades | null;
}

// Celda de referencia (brief/instr/spec): mono tenue, guion si falta.
function Ref({ v }: { v?: string | null }) {
    return v ? <span className="ref">{v}</span> : <span className="dash">—</span>;
}

// Celda de fecha verbatim (nunca se parsea). `est` la pinta ámbar (columna Estimada).
function Fecha({ v, est = false }: { v?: string | null; est?: boolean }) {
    if (v == null || v === "") return <span className="dash">—</span>;
    return <span className={est ? "d est" : "d"}>{v}</span>;
}

function TagCalidad({ v }: { v?: string | null }) {
    const c = claseTag(v);
    if (c === null) return <span className="dash">—</span>;
    return <span className={`tag ${c}`}>{v}</span>;
}

function Desplegado({ v }: { v?: boolean | null }) {
    if (v === true) return <b className="b y">✓</b>;
    return <b className="b n">—</b>;
}

function TuOk({ v }: { v?: string | null }) {
    if (v === "ok") return <b className="b y">✓</b>;
    if (v === "pendiente") return <b className="b w">·</b>;
    return <span className="dash">—</span>;
}

export function TablaFuncionalidades({ f }: Props) {
    const filas = f?.filas ?? [];
    const alerta = f?.alerta && f.alerta.trim() ? f.alerta : null;

    return (
        <>
            <div className="panel">
                <div className="ph">
                    <h2>Funcionalidades</h2>
                    {f?.resumen ? <span className="meta">{f.resumen}</span> : null}
                </div>
                <div className="scroll">
                    <table>
                        <thead>
                            <tr>
                                <th className="c">#</th>
                                <th>Funcionalidad</th>
                                <th className="c">Brief</th>
                                <th className="c">Instr.</th>
                                <th className="c">Spec</th>
                                <th className="c">Inicio</th>
                                <th className="c">Estimada</th>
                                <th className="c">Fin</th>
                                <th className="c">Despl.</th>
                                <th className="c">Calidad</th>
                                <th className="c">Tu OK</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.length === 0 ? (
                                <tr>
                                    <td className="c dash" colSpan={11}>
                                        Sin datos
                                    </td>
                                </tr>
                            ) : (
                                filas.map((row, i) => (
                                    <tr key={row.id || i}>
                                        <td className="c id">{mostrar(row.id)}</td>
                                        <td className="nm">{mostrar(row.nombre)}</td>
                                        <td className="c">
                                            <Ref v={row.brief} />
                                        </td>
                                        <td className="c">
                                            <Ref v={row.instructivo} />
                                        </td>
                                        <td className="c">
                                            <Ref v={row.spec} />
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
                                            <Desplegado v={row.desplegado} />
                                        </td>
                                        <td className="c">
                                            <TagCalidad v={row.calidad} />
                                        </td>
                                        <td className="c">
                                            <TuOk v={row.tuOk} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {alerta ? (
                <div className="alert">
                    <b>Atención</b>
                    <span>{alerta}</span>
                </div>
            ) : null}
        </>
    );
}
