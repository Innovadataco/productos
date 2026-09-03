import type { MotorData } from "@/lib/bi/salud-motor";
import { fmtMiles } from "../pulso/formatos";

/**
 * Deriva del motor (Lote C): tasa de corrección humana semanal promedio (sobre
 * DerivaMotorSnapshot, que ya precocina PI por categoría). Tres semanas seguidas
 * al alza pinta la última barra en ámbar — señal de que el modelo se está
 * desalineando y toca revisar rúbrica o dataset. Sin snapshots, vacío honesto.
 */
export default function DerivaMotor({ data }: { data: MotorData }) {
    const serie = data.deriva;
    const hayAlza =
        serie.length >= 3 &&
        serie[serie.length - 1].tasaCorreccionPct > serie[serie.length - 2].tasaCorreccionPct &&
        serie[serie.length - 2].tasaCorreccionPct > serie[serie.length - 3].tasaCorreccionPct;
    const max = Math.max(...serie.map((d) => d.tasaCorreccionPct), 1);

    return (
        <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "500ms" } as React.CSSProperties}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[17px] font-semibold">Deriva del motor</h3>
                <span
                    className={`text-[11px] font-bold uppercase tracking-[0.12em] ${
                        hayAlza ? "text-estado-ambar" : "text-estado-pino"
                    }`}
                >
                    {hayAlza ? "Corrección al alza" : "En rango"}
                </span>
            </div>
            <div className="mb-4 text-[13px] text-muted">
                Corrección humana semanal promedio (todas las categorías)
            </div>
            {serie.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay snapshots de deriva en la réplica — PI los genera semanalmente.
                </p>
            ) : (
                <div className="flex h-[160px] items-end gap-2 pt-2.5">
                    {serie.map((d, i) => (
                        <div
                            key={d.semana}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                            title={`Semana del ${d.semana}: ${String(d.tasaCorreccionPct).replace(".", ",")}% de corrección en ${d.categorias} categoría(s)`}
                        >
                            <span className="cifra text-[10.5px] font-semibold">
                                {String(d.tasaCorreccionPct).replace(".", ",")}%
                            </span>
                            <div
                                className="barra-crece min-h-[3px] w-full max-w-[38px] rounded-b-sm rounded-t-md"
                                style={
                                    {
                                        height: `${(d.tasaCorreccionPct / max) * 100}%`,
                                        background:
                                            hayAlza && i === serie.length - 1
                                                ? "rgb(var(--ambar-rgb))"
                                                : "linear-gradient(to top, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                        "--anim-retardo": `${i * 60}ms`,
                                    } as React.CSSProperties
                                }
                            />
                            <span className="text-[9.5px] text-subtle">{d.semana.slice(5)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
