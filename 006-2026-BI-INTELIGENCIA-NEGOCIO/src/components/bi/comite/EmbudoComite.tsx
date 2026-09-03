import type { ComiteData } from "@/lib/bi/comite";
import { fmtMiles } from "../pulso/formatos";

/**
 * Embudo de escalamiento (Lote B): de los reportes que entran, cuántos pasan
 * por revisión manual, cuántos se escalan al comité y cuántos se cierran.
 * El paso "escalados" va en rubí: es donde un caso empieza a costar horas
 * humanas. Cifras del ResultSet (candado 10).
 */
export default function EmbudoComite({ data }: { data: ComiteData }) {
    const pasos = [
        { etiqueta: "Reportes registrados", total: data.embudo.reportes },
        { etiqueta: "Pasaron por revisión manual", total: data.embudo.pasaronRevisionManual },
        { etiqueta: "Escalados a comité", total: data.embudo.escalados, cuello: true },
        { etiqueta: "Resueltos por comité", total: data.embudo.resueltos },
    ];
    const max = Math.max(...pasos.map((p) => p.total), 1);
    const todoEnCero = pasos.every((p) => p.total === 0);

    return (
        <div className="glass anim-entrada p-6" style={{ "--anim-retardo": "420ms" } as React.CSSProperties}>
            <h3 className="mb-1 text-[17px] font-semibold">Embudo de escalamiento</h3>
            <div className="mb-4 text-[13px] text-muted">
                Qué tan profundo llega un caso antes de cerrarse — el paso en rubí es donde entra la gestión
                humana
            </div>
            {todoEnCero ? (
                <p className="py-8 text-center text-[13.5px] text-muted">
                    Aún no hay reportes replicados — el embudo se dibuja cuando PI procesa los primeros casos.
                </p>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {pasos.map((p, i) => (
                        <div
                            key={p.etiqueta}
                            className="grid grid-cols-[minmax(0,190px)_1fr_60px] items-center gap-2.5 text-[13px]"
                            title={`${p.etiqueta}: ${fmtMiles(p.total)}`}
                        >
                            <span className={`truncate ${p.cuello ? "font-semibold text-estado-rubi" : ""}`}>
                                {p.etiqueta}
                            </span>
                            <div className="h-5 overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                                <div
                                    className="barra-crece-x h-full rounded-md"
                                    style={
                                        {
                                            width: `${(p.total / max) * 100}%`,
                                            background: p.cuello
                                                ? "rgb(var(--rubi-rgb))"
                                                : "linear-gradient(to right, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                            "--anim-retardo": `${i * 60}ms`,
                                        } as React.CSSProperties
                                    }
                                />
                            </div>
                            <span className="cifra text-right font-semibold">{fmtMiles(p.total)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
