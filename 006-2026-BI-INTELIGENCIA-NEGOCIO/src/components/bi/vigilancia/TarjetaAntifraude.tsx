import type { VigilanciaData } from "@/lib/bi/vigilancia";
import CifraAnimada from "../pulso/CifraAnimada";

/**
 * Tarjeta-monitor "Antifraude" (marco de vigilancia, Lote 1): ráfagas de
 * reportes en 48 h (rubí latiendo si hay alguna) y posible spam de la semana.
 * La tabla FuenteReporte alimenta la detección de ráfagas: mientras la
 * réplica no la traiga se dice "sin datos aún" — jamás un 0 presentado como
 * medición completa (candados 9 y 10; ambas cifras salen de
 * VigilanciaData.antifraude).
 */
export default function TarjetaAntifraude({
    antifraude,
    retardo = 0,
}: {
    antifraude: VigilanciaData["antifraude"];
    retardo?: number;
}) {
    const { rafagas48h, spamSemana, fuenteReporteConDatos } = antifraude;
    const hayRafagas = rafagas48h > 0;

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className={`punto ${hayRafagas ? "punto-bad anim-pulso" : "punto-ok"}`} />
                    <h3 className="text-[16.5px] font-semibold">Antifraude</h3>
                </div>
                <span
                    className={`text-[11px] font-bold uppercase tracking-[0.12em] ${
                        hayRafagas ? "text-estado-rubi" : "text-estado-pino"
                    }`}
                >
                    {hayRafagas ? "Ráfagas activas" : "Sin ráfagas"}
                </span>
            </div>
            <div className="mb-4 text-[13px] text-muted">
                Ráfagas de reportes y spam detectado por el motor
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div
                        className={`cifra text-[32px] font-bold leading-none tracking-tight ${
                            hayRafagas ? "text-estado-rubi" : ""
                        }`}
                    >
                        <CifraAnimada valor={rafagas48h} />
                    </div>
                    <div className="microetiqueta mt-1.5">Ráfagas en 48 h</div>
                </div>
                <div>
                    <div className="cifra text-[32px] font-bold leading-none tracking-tight">
                        <CifraAnimada valor={spamSemana} />
                    </div>
                    <div className="microetiqueta mt-1.5">Posible spam esta semana</div>
                </div>
            </div>

            {!fuenteReporteConDatos && (
                <p className="aviso-honesto">
                    FuenteReporte sin datos aún: la lectura de ráfagas se completa cuando la
                    réplica traiga esa tabla.
                </p>
            )}
        </div>
    );
}
