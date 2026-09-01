import type { PulsoData } from "@/lib/bi/pulso";
import { etiquetaDia, tituloDia } from "./formatos";

/**
 * Barras de reportes por día (mockup pantalla 2): la capa de datos trae los
 * últimos 14 días con huecos rellenados a 0 EN SQL, así que el título puede
 * decirlo con hechos. Las barras crecen escalonadas con la animación CSS
 * `crece` (la altura real vive en el estilo base; con prefers-reduced-motion
 * aparecen directas). Tooltip nativo con el total exacto del día. Serie
 * vacía → nota honesta, nunca un eje de ceros.
 */
export default function GraficoBarras({ serie }: { serie: PulsoData["serieDiaria"] }) {
    const max = Math.max(...serie.map((d) => d.total), 1);
    return (
        <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "660ms" } as React.CSSProperties}>
            <h3 className="mb-1 text-[17px] font-semibold">Reportes por día · últimos 14 días</h3>
            <div className="mb-4 text-[13px] text-muted">Fuente: mv_fact_reporte_diario (réplica read-only)</div>
            {serie.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay reportes replicados en la ventana reciente.
                </p>
            ) : (
                <div className="flex h-[190px] items-end gap-1.5 pt-2.5">
                    {serie.map((d, i) => (
                        <div
                            key={d.dia}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                            title={`${d.total} ${d.total === 1 ? "reporte" : "reportes"} · ${tituloDia(d.dia)}`}
                        >
                            <span className="cifra text-[11px] font-semibold">{d.total}</span>
                            <div
                                className="barra-crece min-h-[3px] w-full max-w-[34px] rounded-b-sm rounded-t-md"
                                style={
                                    {
                                        height: `${(d.total / max) * 100}%`,
                                        backgroundImage:
                                            "linear-gradient(to top, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                        "--anim-retardo": `${i * 55}ms`,
                                    } as React.CSSProperties
                                }
                            />
                            <span className="text-[10px] text-subtle">{etiquetaDia(d.dia)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
