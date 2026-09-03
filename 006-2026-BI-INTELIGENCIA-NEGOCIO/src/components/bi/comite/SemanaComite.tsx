import type { ComiteData } from "@/lib/bi/comite";
import { fmtMiles } from "../pulso/formatos";

/**
 * Actividad semanal del comité (Lote B): barras de solicitudes creadas vs
 * resueltas por semana (últimas 8) con la mediana de horas de resolución de
 * cada semana impresa al lado — cuando existe. Dos series, misma escala:
 * creadas en gradiente, resueltas en pino sólido; si una semana no tiene
 * resueltas, su mediana dice "—" (candado 9).
 */
export default function SemanaComite({ data }: { data: ComiteData }) {
    const serie = data.porSemana;
    const max = Math.max(...serie.flatMap((s) => [s.creadas, s.resueltas]), 1);
    const todoEnCero = serie.every((s) => s.creadas === 0 && s.resueltas === 0);

    return (
        <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "480ms" } as React.CSSProperties}>
            <h3 className="mb-1 text-[17px] font-semibold">Actividad por semana</h3>
            <div className="mb-4 text-[13px] text-muted">
                Solicitudes creadas y resueltas · mediana de horas hasta el cierre
            </div>
            {todoEnCero ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay solicitudes de comité en la réplica — la serie aparece con el primer escalamiento.
                </p>
            ) : (
                <>
                    <div className="flex h-[170px] items-end gap-2 pt-2.5">
                        {serie.map((s, i) => (
                            <div
                                key={s.semana}
                                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                                title={`Semana ${s.semana}: ${fmtMiles(s.creadas)} creadas · ${fmtMiles(s.resueltas)} resueltas · mediana ${s.medianaHoras === null ? "sin cierre" : `${s.medianaHoras.toFixed(1).replace(".", ",")} h`}`}
                            >
                                <div className="flex w-full items-end justify-center gap-1">
                                    <div
                                        className="barra-crece min-h-[3px] w-[16px] rounded-t-sm"
                                        style={
                                            {
                                                height: `${(s.creadas / max) * 100}%`,
                                                backgroundImage:
                                                    "linear-gradient(to top, rgb(var(--cielo-rgb)), rgb(var(--pino-rgb)))",
                                                "--anim-retardo": `${i * 60}ms`,
                                            } as React.CSSProperties
                                        }
                                    />
                                    <div
                                        className="barra-crece min-h-[3px] w-[16px] rounded-t-sm"
                                        style={
                                            {
                                                height: `${(s.resueltas / max) * 100}%`,
                                                background: "rgb(var(--pino-rgb))",
                                                "--anim-retardo": `${i * 60 + 30}ms`,
                                            } as React.CSSProperties
                                        }
                                    />
                                </div>
                                <span className="text-[10px] text-subtle">
                                    {s.semana.slice(s.semana.indexOf("W") + 1)}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex flex-col gap-1">
                        {serie.map((s) => (
                            <div key={`m-${s.semana}`} className="flex justify-between text-[12px] text-muted">
                                <span>Semana {s.semana}</span>
                                <span className="cifra">
                                    mediana {s.medianaHoras === null ? "—" : `${s.medianaHoras.toFixed(1).replace(".", ",")} h`}
                                </span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex gap-4 text-[11.5px] text-muted">
                        <span>
                            <i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "rgb(var(--cielo-rgb))" }} />
                            Creadas
                        </span>
                        <span>
                            <i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "rgb(var(--pino-rgb))" }} />
                            Resueltas
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}
