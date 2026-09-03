import type { MotorData } from "@/lib/bi/salud-motor";
import { fmtMiles } from "../pulso/formatos";

const TH = "microetiqueta text-left font-normal px-3.5 py-2.5 border-b border-[rgb(var(--tinta-rgb)/0.1)]";
const TD = "px-3.5 py-3 border-b border-[rgb(var(--tinta-rgb)/0.06)]";

/** Estado legible: ABIERTO → "Abierto", sin casing crudo. */
function bonito(estado: string): string {
    return estado
        .toLowerCase()
        .split("_")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
}

/**
 * Tablas de infraestructura (Lote C): incidentes recientes de la plataforma
 * (abiertos primero, con duración cuando ya cerraron) y errores de los workers
 * en las últimas 24 h por servicio. IncidenteInfra está vacío hasta que PI
 * registre el primero — el vacío se dice, no se disimula (candados 9 y 10).
 */
export default function TablasMotor({ data }: { data: MotorData }) {
    return (
        <div className="glass anim-entrada px-3 py-2 overflow-x-auto" style={{ "--anim-retardo": "620ms" } as React.CSSProperties}>
            <div className="px-3.5 pt-3">
                <h3 className="text-[15px] font-semibold">Incidentes y errores de workers</h3>
                <div className="mb-2 text-[12.5px] text-muted">
                    Últimos incidentes de infraestructura y fallos por servicio (24 h)
                </div>
            </div>

            {data.incidentes.length === 0 && data.erroresWorker24h.length === 0 ? (
                <p className="py-8 text-center text-[13.5px] text-muted">
                    Sin incidentes registrados ni errores de workers en las últimas 24 h.
                </p>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {data.incidentes.length > 0 && (
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    {["Señal", "Estado", "Inicio", "Duración"].map((h) => (
                                        <th key={h} className={TH}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.incidentes.map((inc) => {
                                    const abierto = inc.estado.toLowerCase() === "abierto";
                                    return (
                                        <tr key={`${inc.senal}-${inc.inicio}`} className="group">
                                            <td className={`${TD} font-semibold group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>
                                                {inc.senal}
                                            </td>
                                            <td className={`${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>
                                                <span className={abierto ? "font-semibold text-estado-rubi" : ""}>
                                                    {bonito(inc.estado)}
                                                </span>
                                            </td>
                                            <td className={`cifra ${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>
                                                {inc.inicio}
                                            </td>
                                            <td className={`cifra ${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>
                                                {inc.duracionMin === null
                                                    ? abierto
                                                        ? "En curso"
                                                        : "—"
                                                    : `${fmtMiles(inc.duracionMin)} min`}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {data.erroresWorker24h.length > 0 && (
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr>
                                    {["Servicio", "Errores 24 h"].map((h) => (
                                        <th key={h} className={TH}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.erroresWorker24h.map((e) => (
                                    <tr key={e.servicio} className="group">
                                        <td className={`${TD} font-semibold group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>
                                            {e.servicio}
                                        </td>
                                        <td className={`cifra ${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>
                                            <span className={e.errores >= 10 ? "font-bold text-estado-rubi" : ""}>
                                                {fmtMiles(e.errores)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
