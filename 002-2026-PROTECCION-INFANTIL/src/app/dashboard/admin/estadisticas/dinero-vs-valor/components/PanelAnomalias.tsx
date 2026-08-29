"use client";

/**
 * SPEC-222 (002-PI-123, US-5, FR-010): panel de anomalías detectadas. Orden
 * severidad (ALTA → MEDIA → BAJA) con badges rubi/ambar/pino; "Revisar"
 * navega al sujeto cuando es una suscripción (vista cliente SPEC-211). Si el
 * modelo aún no está desplegado (`disponible: false`) o no hay anomalías,
 * estado vacío neutral — nunca error.
 */
import { formatoFechaHoraBogota } from "@/lib/fechas/formato-bogota";
import type { AnomaliasRespuesta } from "./tipos";

const CLASE_SEVERIDAD: Record<string, string> = {
    ALTA: "bg-rubi/10 text-rubi dark:bg-rubi/20",
    MEDIA: "bg-ambar/10 text-estado-ambar dark:bg-ambar/20 dark:text-ambar",
    BAJA: "bg-pino/10 text-pino dark:bg-pino/20",
};

export function PanelAnomalias({
    data,
    onNavegarCliente,
}: {
    data: AnomaliasRespuesta;
    onNavegarCliente: (suscripcionId: string) => void;
}) {
    return (
        <section className="glass rounded-3xl p-6" aria-label="Anomalías detectadas">
            <div className="mb-4">
                <h2 className="text-base font-semibold text-body">Anomalías detectadas</h2>
                <p className="text-xs text-muted">Desviaciones estadísticas del comportamiento comercial.</p>
            </div>

            {!data.disponible || data.items.length === 0 ? (
                <p className="rounded-xl border border-tinta/10 p-4 text-sm text-muted">Sin anomalías detectadas.</p>
            ) : (
                <ul className="space-y-3">
                    {data.items.map((anomalia) => {
                        const revisable = anomalia.sujetoTipo === "Suscripcion" && anomalia.sujetoId;
                        return (
                            <li
                                key={anomalia.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-tinta/10 p-4"
                            >
                                <div className="min-w-0">
                                    <div className="mb-1 flex items-center gap-2">
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASE_SEVERIDAD[anomalia.severidad] ?? "bg-tinta/10 text-muted"}`}
                                        >
                                            {anomalia.severidad}
                                        </span>
                                        <span className="text-xs text-muted">
                                            {formatoFechaHoraBogota(anomalia.detectadaEn)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-body">{anomalia.descripcion}</p>
                                </div>
                                {revisable && anomalia.sujetoId ? (
                                    <button
                                        type="button"
                                        onClick={() => onNavegarCliente(anomalia.sujetoId!)}
                                        className="rounded-lg border border-tinta/20 px-4 py-2 text-sm font-medium text-body transition hover:bg-tinta/5"
                                    >
                                        Revisar
                                    </button>
                                ) : null}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
