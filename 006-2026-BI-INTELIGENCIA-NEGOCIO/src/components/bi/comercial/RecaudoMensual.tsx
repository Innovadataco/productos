import type { ComercialData } from "@/lib/bi/comercial";
import { fmtCOP } from "../pulso/formatos";

/**
 * Recaudo real por mes (Lote A): barras verticales de los últimos 12 meses
 * sobre montoRealPagado (altas manuales autorizadas). Tooltip con el COP
 * exacto del ResultSet (candado 10); el eje imprime miles de pesos ("18,4 M"
 * es formato de presentación, no una métrica nueva — el tooltip lleva la cifra
 * completa). Meses sin pagos salen en cero de verdad: la serie viene de
 * generate_series en SQL, no de un array rellenado a mano.
 */
export default function RecaudoMensual({ data }: { data: ComercialData }) {
    const serie = data.recaudoPorMes;
    const max = Math.max(...serie.map((d) => d.total), 1);
    const todoEnCero = serie.every((d) => d.total === 0);

    return (
        <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "480ms" } as React.CSSProperties}>
            <h3 className="mb-1 text-[17px] font-semibold">Recaudo real por mes</h3>
            <div className="mb-4 text-[13px] text-muted">
                Últimos 12 meses · monto pagado declarado en las altas manuales (COP)
            </div>
            {todoEnCero ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay pagos registrados en la réplica — las barras aparecen en cuanto PI reporta el
                    primer pago autorizado.
                </p>
            ) : (
                <div className="flex h-[180px] items-end gap-1.5 pt-2.5">
                    {serie.map((d, i) => (
                        <div
                            key={d.mes}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                            title={`${d.mes}: ${fmtCOP(d.total)}`}
                        >
                            <span className="cifra text-[10.5px] font-semibold">
                                {d.total > 0 ? `${(d.total / 1_000_000).toFixed(1).replace(".", ",")}M` : ""}
                            </span>
                            <div
                                className="barra-crece min-h-[3px] w-full max-w-[38px] rounded-b-sm rounded-t-md"
                                style={
                                    {
                                        height: `${(d.total / max) * 100}%`,
                                        backgroundImage:
                                            "linear-gradient(to top, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                        "--anim-retardo": `${i * 55}ms`,
                                    } as React.CSSProperties
                                }
                            />
                            <span className="text-[10px] text-subtle">{d.mes.slice(5)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
