import type { ComiteData } from "@/lib/bi/comite";
import { fmtMiles } from "../pulso/formatos";

const TH = "microetiqueta text-left font-normal px-3.5 py-2.5 border-b border-[rgb(var(--tinta-rgb)/0.1)]";
const TD = "px-3.5 py-3 border-b border-[rgb(var(--tinta-rgb)/0.06)]";

/** Etiqueta legible de estado: PENDIENTE → "Pendiente", sin casing crudo. */
function bonito(estado: string): string {
    return estado
        .toLowerCase()
        .split("_")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
}

/**
 * Tablas de Comité (Lote B): carga activa por comité (plataforma o colegio,
 * con mediana de horas de sus resoluciones históricas), estados de todas las
 * solicitudes y alertas de colegio escaladas por estado. La fila legal de
 * apelaciones NO se simula: esa tabla no se replica (gobierno) — solo se
 * mide la operación del comité. Cifras del ResultSet (candado 10).
 */
export default function TablasComite({ data }: { data: ComiteData }) {
    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <div className="glass anim-entrada px-3 py-2 overflow-x-auto" style={{ "--anim-retardo": "540ms" } as React.CSSProperties}>
                <div className="px-3.5 pt-3">
                    <h3 className="text-[15px] font-semibold">Carga activa por comité</h3>
                    <div className="mb-2 text-[12.5px] text-muted">Solicitudes abiertas y mediana histórica de cierre</div>
                </div>
                {data.cargaPorComite.length === 0 ? (
                    <p className="py-8 text-center text-[13.5px] text-muted">
                        Sin solicitudes abiertas — la cola del comité está en cero.
                    </p>
                ) : (
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr>
                                {["Comité", "Abiertas", "Mediana"].map((h) => (
                                    <th key={h} className={TH}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.cargaPorComite.map((c) => (
                                <tr key={c.comite} className="group">
                                    <td className={`${TD} font-semibold group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>{c.comite}</td>
                                    <td className={`cifra ${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>
                                        {c.activas > 0 ? <span className={c.activas >= 10 ? "font-bold text-estado-ambar" : ""}>{fmtMiles(c.activas)}</span> : "—"}
                                    </td>
                                    <td className={`cifra ${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>
                                        {c.medianaHoras === null ? "—" : `${c.medianaHoras.toFixed(1).replace(".", ",")} h`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "600ms" } as React.CSSProperties}>
                <h3 className="mb-1 text-[15px] font-semibold">Estados de las solicitudes</h3>
                <div className="mb-4 text-[12.5px] text-muted">Distribución completa en la réplica</div>
                {data.porEstado.length === 0 ? (
                    <p className="py-8 text-center text-[13.5px] text-muted">Aún no hay solicitudes registradas.</p>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {data.porEstado.map((e, i) => {
                            const max = Math.max(...data.porEstado.map((x) => x.total), 1);
                            const abierto = e.estado.toLowerCase() !== "resuelta";
                            return (
                                <div
                                    key={e.estado}
                                    className="grid grid-cols-[minmax(0,120px)_1fr_52px] items-center gap-2.5 text-[13px]"
                                    title={`${bonito(e.estado)}: ${fmtMiles(e.total)}`}
                                >
                                    <span className={`truncate ${abierto ? "font-semibold text-estado-ambar" : ""}`}>
                                        {bonito(e.estado)}
                                    </span>
                                    <div className="h-5 overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                                        <div
                                            className="barra-crece-x h-full rounded-md"
                                            style={
                                                {
                                                    width: `${(e.total / max) * 100}%`,
                                                    background: abierto
                                                        ? "rgb(var(--ambar-rgb))"
                                                        : "linear-gradient(to right, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                                    "--anim-retardo": `${i * 60}ms`,
                                                } as React.CSSProperties
                                            }
                                        />
                                    </div>
                                    <span className="cifra text-right font-semibold">{fmtMiles(e.total)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "660ms" } as React.CSSProperties}>
                <h3 className="mb-1 text-[15px] font-semibold">Alertas de colegio por estado</h3>
                <div className="mb-4 text-[12.5px] text-muted">Nuevas, vistas, gestionadas y escaladas</div>
                {data.alertasPorEstado.length === 0 ? (
                    <p className="py-8 text-center text-[13.5px] text-muted">Aún no hay alertas replicadas.</p>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {data.alertasPorEstado.map((e, i) => {
                            const max = Math.max(...data.alertasPorEstado.map((x) => x.total), 1);
                            const escalada = e.estado.toLowerCase() === "escalada";
                            return (
                                <div
                                    key={e.estado}
                                    className="grid grid-cols-[minmax(0,110px)_1fr_52px] items-center gap-2.5 text-[13px]"
                                    title={`${bonito(e.estado)}: ${fmtMiles(e.total)}`}
                                >
                                    <span className={`truncate ${escalada ? "font-semibold text-estado-rubi" : ""}`}>
                                        {bonito(e.estado)}
                                    </span>
                                    <div className="h-5 overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                                        <div
                                            className="barra-crece-x h-full rounded-md"
                                            style={
                                                {
                                                    width: `${(e.total / max) * 100}%`,
                                                    background: escalada
                                                        ? "rgb(var(--rubi-rgb))"
                                                        : "linear-gradient(to right, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                                    "--anim-retardo": `${i * 60}ms`,
                                                } as React.CSSProperties
                                            }
                                        />
                                    </div>
                                    <span className="cifra text-right font-semibold">{fmtMiles(e.total)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
