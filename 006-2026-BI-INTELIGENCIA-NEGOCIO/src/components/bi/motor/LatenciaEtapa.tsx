import type { MotorData } from "@/lib/bi/salud-motor";
import { fmtMiles } from "../pulso/formatos";

/**
 * Latencia media por etapa del pipeline (Lote C): dónde se gasta el tiempo de
 * procesamiento — ordenada de mayor a menor con ms exactos y número de
 * muestras de la semana. La etapa que domina sale en ámbar. Sin pasos
 * registrados, se dice el vacío (candado 9).
 */
export default function LatenciaEtapa({ data }: { data: MotorData }) {
    const filas = data.latenciaPorEtapa;
    const max = Math.max(...filas.map((f) => f.mediaMs), 1);

    return (
        <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "440ms" } as React.CSSProperties}>
            <h3 className="mb-1 text-[17px] font-semibold">Latencia por etapa del pipeline</h3>
            <div className="mb-4 text-[13px] text-muted">
                Promedio en milisegundos · últimos 7 días — la etapa más pesada marca dónde optimizar
            </div>
            {filas.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay pasos de procesamiento replicados — la telemetría aparece en cuanto PI procese
                    reportes con la traza activa.
                </p>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {filas.map((f, i) => (
                        <div
                            key={f.etapa}
                            className="grid grid-cols-[minmax(0,180px)_1fr_110px] items-center gap-2.5 text-[13px]"
                            title={`${f.etapa}: ${fmtMiles(Math.round(f.mediaMs))} ms de media en ${fmtMiles(f.muestras)} paso(s)`}
                        >
                            <span className={`truncate ${i === 0 ? "font-semibold text-estado-ambar" : ""}`}>
                                {f.etapa}
                            </span>
                            <div className="h-5 overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                                <div
                                    className="barra-crece-x h-full rounded-md"
                                    style={
                                        {
                                            width: `${(f.mediaMs / max) * 100}%`,
                                            background:
                                                i === 0
                                                    ? "rgb(var(--ambar-rgb))"
                                                    : "linear-gradient(to right, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                            "--anim-retardo": `${i * 60}ms`,
                                        } as React.CSSProperties
                                    }
                                />
                            </div>
                            <span className="cifra text-right text-[12.5px] font-semibold">
                                {fmtMiles(Math.round(f.mediaMs))} ms
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
