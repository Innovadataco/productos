import type { ComercialData } from "@/lib/bi/comercial";
import { fmtCOP } from "../pulso/formatos";

const TH = "microetiqueta text-left font-normal px-3.5 py-2.5 border-b border-[rgb(var(--tinta-rgb)/0.1)]";
const TD = "px-3.5 py-3 border-b border-[rgb(var(--tinta-rgb)/0.06)]";

/** Etiqueta legible y punto semáforo por estado de suscripción. */
function celdaEstado(estado: string) {
    const e = estado.toLowerCase();
    const punto = e === "activa" ? "punto-ok" : e === "en_gracia" ? "punto-warn" : "punto-bad";
    const texto = e === "en_gracia" ? "En gracia" : estado.charAt(0).toUpperCase() + estado.slice(1).toLowerCase();
    return (
        <span className="inline-flex items-center gap-[7px] font-semibold text-[13px]">
            <span className={`punto ${punto}`} />
            {texto}
        </span>
    );
}

/**
 * Tablas de Comercial (Lote A): vencimientos de los próximos 7 días (a quién
 * llamar) y top de titulares por valor acumulado pagado. Nombres de colegio en
 * claro — visible solo para el CEO/admin de BI (decisión ARQ_07). Las filas y
 * cifras son del ResultSet (candado 10); los estados se normalizan solo a
 * nivel de presentación.
 */
export default function TablasComercial({ data }: { data: ComercialData }) {
    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <div className="glass anim-entrada px-3 py-2 overflow-x-auto" style={{ "--anim-retardo": "600ms" } as React.CSSProperties}>
                <div className="px-3.5 pt-3">
                    <h3 className="text-[15px] font-semibold">Vencen en los próximos 7 días</h3>
                    <div className="mb-2 text-[12.5px] text-muted">Suscripciones a las que hay que llamar esta semana</div>
                </div>
                {data.vencen7Dias.length === 0 ? (
                    <p className="py-8 text-center text-[13.5px] text-muted">
                        Nada vence en los próximos 7 días — la semana de cobranza está despejada.
                    </p>
                ) : (
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr>
                                {["Titular", "Plan", "Estado", "Vence"].map((h) => (
                                    <th key={h} className={TH}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.vencen7Dias.map((v) => (
                                <tr key={`${v.titular}-${v.venceEn}`} className="group">
                                    <td className={`${TD} font-semibold group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>{v.titular}</td>
                                    <td className={`cifra ${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>{v.plan ?? "—"}</td>
                                    <td className={`${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>{celdaEstado(v.estado)}</td>
                                    <td className={`cifra ${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>{v.venceEn}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="glass anim-entrada px-3 py-2 overflow-x-auto" style={{ "--anim-retardo": "660ms" } as React.CSSProperties}>
                <div className="px-3.5 pt-3">
                    <h3 className="text-[15px] font-semibold">Top clientes por valor acumulado</h3>
                    <div className="mb-2 text-[12.5px] text-muted">Lo que cada titular ha pagado acumulado (COP)</div>
                </div>
                {data.topClientes.length === 0 ? (
                    <p className="py-8 text-center text-[13.5px] text-muted">
                        Aún no hay pagos acumulados en la réplica — este ranking aparece con el primer titular
                        pagante.
                    </p>
                ) : (
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr>
                                {["Titular", "Acumulado", "Antigüedad", "Estado"].map((h) => (
                                    <th key={h} className={TH}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.topClientes.map((t) => (
                                <tr key={t.titular} className="group">
                                    <td className={`${TD} font-semibold group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>{t.titular}</td>
                                    <td className={`cifra ${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>{fmtCOP(t.acumulado)}</td>
                                    <td className={`cifra ${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>
                                        {t.antiguedadMeses === null ? "—" : `${t.antiguedadMeses} mes(es)`}
                                    </td>
                                    <td className={`${TD} group-hover:bg-[rgb(var(--tinta-rgb)/0.04)]`}>{celdaEstado(t.estado)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
