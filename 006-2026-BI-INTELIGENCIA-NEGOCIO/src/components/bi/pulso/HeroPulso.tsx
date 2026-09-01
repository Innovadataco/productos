import GaugeSalud from "./GaugeSalud";
import { formatoHace } from "./formatos";

/**
 * Hero del Pulso (mockup pantalla 2): titular serif con palabra de estado
 * viva — "en calma" (pino) en operación normal, "bajo atención" (ámbar) si
 * BI detectó algo — y sublínea con los reportes de hoy y el último reporte.
 *
 * hayDatos=false → versión HONESTA del vacío con el mismo diseño: se dice
 * que aún no hay actividad replicada suficiente; jamás ceros como si fueran
 * medición (candado 9).
 */
export default function HeroPulso({
    hayDatos,
    enAtencion,
    reportesHoy,
    ultimoReporteHaceMin,
    saludOperativa,
}: {
    hayDatos: boolean;
    enAtencion: boolean;
    reportesHoy: number;
    ultimoReporteHaceMin: number | null;
    saludOperativa: number | null;
}) {
    if (!hayDatos) {
        return (
            <div className="mb-6 grid items-center gap-5 md:grid-cols-[1.5fr_1fr]">
                <div className="anim-entrada" style={{ "--anim-retardo": "120ms" } as React.CSSProperties}>
                    <h2 className="font-serif text-[clamp(34px,5vw,56px)] leading-[1.05] tracking-[-0.022em]">
                        Aún no hay actividad replicada{" "}
                        <em className="text-[rgb(var(--cielo-ink-rgb))]">suficiente</em>
                    </h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[15px] text-muted">
                        <span className="punto punto-warn" />
                        <span>
                            En cuanto la réplica de PI acumule actividad, este tablero se enciende solo —
                            mientras tanto no hay cifras que mostrar.
                        </span>
                    </div>
                </div>
                <GaugeSalud valor={null} />
            </div>
        );
    }

    return (
        <div className="mb-6 grid items-center gap-5 md:grid-cols-[1.5fr_1fr]">
            <div className="anim-entrada" style={{ "--anim-retardo": "120ms" } as React.CSSProperties}>
                <h2 className="font-serif text-[clamp(34px,5vw,56px)] leading-[1.05] tracking-[-0.022em]">
                    La operación respira{" "}
                    <em
                        className={`transition-colors duration-700 ${
                            enAtencion ? "text-estado-ambar" : "text-estado-pino"
                        }`}
                    >
                        {enAtencion ? "bajo atención" : "en calma"}
                    </em>
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[15px] text-muted">
                    <span className={`punto anim-pulso ${enAtencion ? "punto-warn" : "punto-ok"}`} />
                    <span>
                        <b className="cifra font-semibold text-body">{reportesHoy}</b>{" "}
                        {reportesHoy === 1 ? "reporte hoy" : "reportes hoy"}
                        {ultimoReporteHaceMin !== null && (
                            <>
                                {" "}· último{" "}
                                <b className="font-semibold text-body">{formatoHace(ultimoReporteHaceMin)}</b>
                            </>
                        )}
                    </span>
                </div>
            </div>
            <GaugeSalud valor={saludOperativa} />
        </div>
    );
}
