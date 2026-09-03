import type { VigilanciaData } from "@/lib/bi/vigilancia";
import { fmtMiles } from "../pulso/formatos";

/** Horas medias de una etapa: NULL → "sin medición" (candado 9, jamás 0 inventado). */
function fmtHorasMedias(horasMedias: number | null): string {
    if (horasMedias === null) return "sin medición";
    return `media ${horasMedias.toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`;
}

/**
 * Tarjeta-monitor "Ciclo de vida del reporte" (marco de vigilancia, Lote 1):
 * embudo horizontal de las etapas por las que pasa un reporte, con su total
 * real y las horas medias que tarda cada transición. Un hueco de medición se
 * dice ("sin medición"), no se disfraza de cero.
 *
 * El badge de atascados es la alarma de la tarjeta: rubí con el conteo cuando
 * hay reportes congelados en una etapa, pino "sin atascos" cuando no.
 *
 * Candado 10: totales y horas salen de VigilanciaData.cicloVida; el ancho de
 * cada fill es solo la proporción de presentación contra la primera etapa
 * (semántica de embudo, igual que Embudo del Pulso).
 */
export default function TarjetaCicloVida({
    cicloVida,
    retardo = 0,
}: {
    cicloVida: VigilanciaData["cicloVida"];
    retardo?: number;
}) {
    const { etapas, atascados } = cicloVida;
    const hayAtascos = atascados > 0;
    // Referencia del 100%: el total de la primera etapa (boca del embudo).
    const referencia = etapas[0]?.total ?? 0;

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className={`punto ${hayAtascos ? "punto-bad anim-pulso" : "punto-ok"}`} />
                    <h3 className="text-[16.5px] font-semibold">Ciclo de vida del reporte</h3>
                </div>
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] ${
                        hayAtascos
                            ? "border-[rgb(var(--rubi-rgb)/0.35)] bg-[rgb(var(--rubi-rgb)/0.1)] text-estado-rubi"
                            : "border-[rgb(var(--pino-rgb)/0.35)] bg-[rgb(var(--pino-rgb)/0.08)] text-estado-pino"
                    }`}
                >
                    <span className={`punto ${hayAtascos ? "punto-bad anim-pulso" : "punto-ok"}`} />
                    {hayAtascos ? `${fmtMiles(atascados)} atascados` : "sin atascos"}
                </span>
            </div>
            <div className="mb-4 text-[13px] text-muted">
                Etapas del flujo y tiempo medio en cada una
            </div>

            {etapas.length === 0 ? (
                <p className="py-4 text-[13px] text-muted">
                    Aún no hay etapas medidas en la réplica.
                </p>
            ) : (
                <ul className="flex flex-col gap-2.5">
                    {etapas.map((e, i) => (
                        <li
                            key={`${e.etapa}-${i}`}
                            className="grid grid-cols-[minmax(0,150px)_1fr_56px] items-center gap-3"
                            title={`${e.etapa}: ${fmtMiles(e.total)} reportes · ${fmtHorasMedias(e.horasMedias)}`}
                        >
                            <div className="min-w-0">
                                <div className="truncate text-[13.5px]">{e.etapa}</div>
                                <div className="text-[11.5px] text-subtle">
                                    {fmtHorasMedias(e.horasMedias)}
                                </div>
                            </div>
                            <div className="h-[22px] overflow-hidden rounded-lg bg-[rgb(var(--tinta-rgb)/0.06)]">
                                <div
                                    className="barra-crece-x h-full rounded-lg bg-[linear-gradient(to_right,rgb(var(--cielo-rgb)),rgb(var(--pino-rgb)))]"
                                    style={
                                        {
                                            width: `${referencia > 0 ? Math.min((e.total / referencia) * 100, 100) : 0}%`,
                                            "--anim-retardo": `${retardo + 120 + i * 60}ms`,
                                        } as React.CSSProperties
                                    }
                                />
                            </div>
                            <span className="cifra text-right text-[13.5px] font-bold">
                                {fmtMiles(e.total)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
