import { formatoHace } from "./formatos";

/**
 * Ticker en vivo del Pulso (mockup-bi-v2 · pantalla 2): la pista lleva DOS
 * copias idénticas de los eventos y la animación CSS `rodar` desplaza -50%
 * (exactamente una copia) → bucle continuo sin JS. La segunda copia es
 * aria-hidden. Cada copia lleva su propio padding derecho igual al gap para
 * que el corte del -50% caiga exacto y no haya salto.
 *
 * Los eventos llegan ya redactados de la capa de datos (candado 9): aquí
 * solo se les da formato de tiempo relativo. Sin eventos → mensaje honesto
 * y estático (no hay nada que desfilar).
 */
export default function TickerVivo({
    items,
}: {
    items: { haceMin: number; texto: string }[];
}) {
    return (
        <div
            className="anim-entrada mb-7 flex items-center overflow-hidden rounded-full border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.5)]"
            style={{ "--anim-retardo": "60ms" } as React.CSSProperties}
        >
            <span className="flex shrink-0 items-center gap-2 self-stretch bg-[rgb(var(--pino-rgb)/0.16)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-estado-pino">
                <span className="punto punto-ok anim-pulso" /> En vivo
            </span>
            <div className="flex-1 overflow-hidden">
                {items.length === 0 ? (
                    <p className="px-4 py-2 text-[13px] text-muted">
                        Sin eventos recientes — la réplica aún no registra actividad.
                    </p>
                ) : (
                    <div className="ticker-pista">
                        {[false, true].map((oculta) => (
                            <div
                                key={oculta ? "copia" : "original"}
                                className="flex items-center gap-14 pr-14"
                                aria-hidden={oculta || undefined}
                            >
                                {items.map((item, i) => (
                                    <span key={i} className="whitespace-nowrap text-[13px] text-muted">
                                        <b className="font-semibold text-body">{formatoHace(item.haceMin)}</b>
                                        {" · "}
                                        {item.texto}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
