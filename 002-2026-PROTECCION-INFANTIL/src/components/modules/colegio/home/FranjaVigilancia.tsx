import { relativoHumano } from "@/lib/colegio/fechas-humano";
import type { LatidoMotor } from "@/lib/monitoreo/latido-motor";

/**
 * SPEC-143 (US1, FR-008, D3) — Franja de vigilancia: SOLO VERDADES (regla de ZEUS).
 *   (a) "Última señal sobre su colegio" = max(AlertaColegio.creadoEn) — por colegio,
 *       puede no existir nunca → copy honesto "sin señales aún".
 *   (b) "Estado del sistema" = latido del MOTOR de clasificación.
 * Más los reportes de la semana (métrica D2) con su delta vs la anterior, en texto.
 *
 * SPEC-670 / I-396 — El hecho (b) YA NO es el latido del worker. Antes decía
 * "Última revisión del sistema · hace un momento" alimentado por `worker.heartbeat`,
 * que late aunque Ollama esté caído y cada job falle: afirmaba una frescura que no
 * tenía (defecto vivo el 11-09). Ahora sale de `LatidoMotor` (sonda ACTIVA del
 * motor: `ollama_smoke`/incidentes), con dos estados y el reloj SOLO si hay señal real:
 *   · vivo  → "Clasificación activa" + "Última clasificación: hace X".
 *   · caído → "Clasificación en pausa" (ámbar) + la promesa de que nada se pierde.
 * Sin señal (`ultimaVerificacionEn === null`) NO se muestra reloj: la conducta se
 * mide, no se afirma. Prohibido un "hace un momento" fijo o un estado cableado a verde.
 */

interface FranjaVigilanciaProps {
    ultimaSenal: Date | null;
    motor: LatidoMotor;
    reportesSemana: number;
    deltaSemana: number;
    className?: string;
}

function copyDelta(delta: number): string {
    if (delta > 0) return `${delta} más que la semana anterior`;
    if (delta < 0) return `${-delta} menos que la semana anterior`;
    return "igual que la semana anterior";
}

export function FranjaVigilancia({ ultimaSenal, motor, reportesSemana, deltaSemana, className = "" }: FranjaVigilanciaProps) {
    return (
        <section
            aria-label="Vigilancia"
            className={`glass rounded-[var(--radio-card)] px-5 py-4 ${className}`}
        >
            <dl className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-8">
                <div>
                    <dt className="microetiqueta">Última señal sobre su colegio</dt>
                    <dd className="mt-0.5 text-sm font-medium text-body">
                        {ultimaSenal ? (
                            <time dateTime={ultimaSenal.toISOString()}>{relativoHumano(ultimaSenal)}</time>
                        ) : (
                            "Sin señales aún — la vigilancia está activa"
                        )}
                    </dd>
                </div>
                <div className="sm:max-w-xs">
                    <dt className="microetiqueta">Estado del sistema</dt>
                    <dd className="mt-0.5 text-sm">
                        <span className={`font-medium ${motor.motorVivo ? "text-body" : "text-ambar"}`}>
                            {motor.motorVivo ? "Clasificación activa" : "Clasificación en pausa"}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                            {motor.motorVivo
                                ? "El sistema está revisando los reportes con normalidad."
                                : "El clasificador no está procesando en este momento. Los reportes se siguen recibiendo y quedan guardados; se clasificarán cuando el servicio se restablezca."}
                        </span>
                        {motor.ultimaVerificacionEn ? (
                            <span className="mt-0.5 block text-xs text-muted">
                                Última clasificación:{" "}
                                <time dateTime={motor.ultimaVerificacionEn.toISOString()}>
                                    {relativoHumano(motor.ultimaVerificacionEn)}
                                </time>
                                .
                            </span>
                        ) : null}
                    </dd>
                </div>
                <div>
                    <dt className="microetiqueta">Esta semana</dt>
                    <dd className="mt-0.5 text-sm font-medium text-body">
                        {reportesSemana} {reportesSemana === 1 ? "reporte recibido" : "reportes recibidos"}
                        <span className="text-muted"> · {copyDelta(deltaSemana)}</span>
                    </dd>
                </div>
            </dl>
        </section>
    );
}
