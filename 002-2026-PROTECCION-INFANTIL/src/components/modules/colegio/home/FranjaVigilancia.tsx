import { relativoHumano } from "@/lib/colegio/fechas-humano";

/**
 * SPEC-143 (US1, FR-008, D3) — Franja de vigilancia: SOLO VERDADES (regla de ZEUS).
 * Los DOS hechos de D3, cada uno con su etiqueta correcta:
 *   (a) "Última señal sobre su colegio" = max(AlertaColegio.creadoEn) — por colegio,
 *       puede no existir nunca → copy honesto "sin señales aún".
 *   (b) "Última revisión del sistema" = heartbeat del worker — global y verdadero.
 * Más los reportes de la semana (métrica D2) con su delta vs la anterior, sin
 * "-0" ni porcentajes infinitos: la comparación se dice en personas, en texto.
 */

interface FranjaVigilanciaProps {
    ultimaSenal: Date | null;
    latidoSistema: Date | null;
    reportesSemana: number;
    deltaSemana: number;
    className?: string;
}

function copyDelta(delta: number): string {
    if (delta > 0) return `${delta} más que la semana anterior`;
    if (delta < 0) return `${-delta} menos que la semana anterior`;
    return "igual que la semana anterior";
}

export function FranjaVigilancia({ ultimaSenal, latidoSistema, reportesSemana, deltaSemana, className = "" }: FranjaVigilanciaProps) {
    return (
        <section
            aria-label="Vigilancia"
            className={`glass rounded-[var(--radio-card)] px-5 py-4 ${className}`}
        >
            <dl className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
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
                <div>
                    <dt className="microetiqueta">Última revisión del sistema</dt>
                    <dd className="mt-0.5 text-sm font-medium text-body">
                        {latidoSistema ? (
                            <time dateTime={latidoSistema.toISOString()}>{relativoHumano(latidoSistema)}</time>
                        ) : (
                            "Sin registro de revisión aún"
                        )}
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
