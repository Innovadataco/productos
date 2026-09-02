import type { PulsoData } from "@/lib/bi/pulso";
import CifraAnimada from "./CifraAnimada";
import { fmtMiles } from "./formatos";

/** Tope de colegios listados en la tarjeta (constante de presentación). */
const TOP_COLEGIOS_SLA = 5;

/**
 * Tarjeta "SLA vencido" del Pulso siguiente nivel: alertas de colegio cuyo
 * vencimientoSla ya pasó y siguen abiertas. Rubí cuando hay vencidas (> 0),
 * pino cuando no hay ninguna; el punto de estado late solo en el caso rubí
 * (prefers-reduced-motion lo apaga vía la regla global).
 *
 * Candado 9: si no hay colegios con vencidas se dice en texto, no se pinta
 * una lista vacía. Candado 10: la cifra y el top salen de PulsoData.sla; el
 * ancho de cada barra es solo la proporción de presentación contra el
 * máximo del top (misma forma que las demás barras del tablero).
 */
export default function TarjetaSla({
    sla,
    retardo = 0,
}: {
    sla: PulsoData["sla"];
    retardo?: number;
}) {
    const vencidas = sla.vencidas;
    const top = sla.porColegio.slice(0, TOP_COLEGIOS_SLA);
    const maximo = Math.max(...top.map((c) => c.vencidas), 1);
    const restantes = Math.max(0, sla.porColegio.length - top.length);

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <div className="mb-1 flex items-center gap-2">
                <span
                    className={`punto ${vencidas > 0 ? "punto-bad anim-pulso" : "punto-ok"}`}
                />
                <h3 className="text-[16.5px] font-semibold">SLA vencido</h3>
            </div>
            <div className="mb-4 text-[13px] text-muted">
                vencimientoSla superado y alerta aún abierta
            </div>
            <div
                className={`cifra text-[42px] font-bold leading-[1.1] tracking-tight ${
                    vencidas > 0 ? "text-estado-rubi" : "text-estado-pino"
                }`}
            >
                <CifraAnimada valor={vencidas} />
            </div>
            <div className="mb-4 text-[12.5px] text-muted">
                {vencidas === 1 ? "alerta con el SLA vencido" : "alertas con el SLA vencido"}
            </div>
            {top.length === 0 ? (
                <p className="text-[13px] text-muted">
                    Ningún colegio con alertas vencidas en la réplica.
                </p>
            ) : (
                <>
                    <div className="microetiqueta mb-2">Colegios con más vencidas</div>
                    <ul className="space-y-2.5">
                        {top.map((c, i) => (
                            <li key={c.colegio}>
                                <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
                                    <span className="truncate">{c.colegio}</span>
                                    <span className="cifra font-semibold text-estado-rubi">
                                        {fmtMiles(c.vencidas)}
                                    </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--tinta-rgb)/0.08)]">
                                    <div
                                        className="barra-crece-x h-full rounded-full bg-[rgb(var(--rubi-rgb)/0.75)]"
                                        style={
                                            {
                                                width: `${Math.round((c.vencidas / maximo) * 100)}%`,
                                                "--anim-retardo": `${retardo + 120 + i * 60}ms`,
                                            } as React.CSSProperties
                                        }
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                    {restantes > 0 && (
                        <p className="mt-3 text-[12px] text-subtle">
                            y {fmtMiles(restantes)}{" "}
                            {restantes === 1 ? "colegio más" : "colegios más"} con alertas
                            vencidas.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
