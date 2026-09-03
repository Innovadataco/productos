import type { MotorData } from "@/lib/bi/salud-motor";
import { ETIQUETAS_CATEGORIA } from "../etiquetas";
import { fmtMiles } from "../pulso/formatos";

/**
 * Top de correcciones humanas del mes (Lote C): categorías con más correcciones
 * confirmadas por operadores, ordenadas de mayor a menor. La barra más larga
 * pinta en ámbar — es donde el modelo más se equivoca hoy. Categoría cruda del
 * ResultSet traducida solo para presentación (candado 10: las cifras no se tocan).
 */
export default function CorreccionesTop({ data }: { data: MotorData }) {
    const top = data.topCorrecciones;
    const max = Math.max(...top.map((t) => t.correcciones), 1);

    return (
        <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "560ms" } as React.CSSProperties}>
            <h3 className="mb-1 text-[15px] font-semibold">Donde se corrige al modelo</h3>
            <div className="mb-4 text-[12.5px] text-muted">
                Categorías con más correcciones humanas confirmadas este mes
            </div>
            {top.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Sin correcciones confirmadas este mes — nadie corrigió al modelo todavía.
                </p>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {top.map((t, i) => (
                        <div
                            key={t.categoria}
                            className="grid grid-cols-[minmax(0,150px)_1fr_44px] items-center gap-2.5 text-[13px]"
                            title={`${ETIQUETAS_CATEGORIA[t.categoria] ?? t.categoria}: ${fmtMiles(t.correcciones)} correcciones`}
                        >
                            <span className={`truncate ${i === 0 ? "font-semibold text-estado-ambar" : ""}`}>
                                {ETIQUETAS_CATEGORIA[t.categoria] ?? t.categoria}
                            </span>
                            <div className="h-5 overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                                <div
                                    className="barra-crece-x h-full rounded-md"
                                    style={
                                        {
                                            width: `${(t.correcciones / max) * 100}%`,
                                            background:
                                                i === 0
                                                    ? "rgb(var(--ambar-rgb))"
                                                    : "linear-gradient(to right, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                            "--anim-retardo": `${i * 60}ms`,
                                        } as React.CSSProperties
                                    }
                                />
                            </div>
                            <span className="cifra text-right font-semibold">{fmtMiles(t.correcciones)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
