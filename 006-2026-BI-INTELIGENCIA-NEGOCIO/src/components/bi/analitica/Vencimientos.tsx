import type { AnaliticaData } from "@/lib/bi/analitica";
import { fmtMiles } from "@/components/bi/pulso/formatos";

/**
 * Vencimientos próximos (mockup v4, sección 5 derecha): suscripciones que
 * vencen — para llamar y motivar. Mismo patrón de barras horizontales del
 * sistema pero con el fill semántico del mockup (rubí esta semana, ámbar a 15
 * días, gradiente a 30, cielo freemium), que el componente compartido no
 * soporta. Cifras del contrato (candado 10); si no hay nada próximo ni
 * freemium, se dice honestamente (candado 9).
 */
export default function Vencimientos({
    vencimientos,
}: {
    vencimientos: AnaliticaData["vencimientos"];
}) {
    const filas = [
        { etiqueta: "Esta semana", total: vencimientos.estaSemana, fill: "rgb(var(--rubi-rgb))" },
        { etiqueta: "En 15 días", total: vencimientos.en15d, fill: "rgb(var(--ambar-rgb))" },
        {
            etiqueta: "En 30 días",
            total: vencimientos.en30d,
            fill: "linear-gradient(to right, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
        },
        { etiqueta: "Freemium activo", total: vencimientos.freemiumActivo, fill: "rgb(var(--cielo-rgb))" },
    ];
    const max = Math.max(...filas.map((f) => f.total), 1);
    const todoEnCero = filas.every((f) => f.total === 0);

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": "520ms" } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[17px] font-semibold">Vencimientos próximos</h3>
            <div className="mb-4 text-[13px] text-muted">Suscripciones que vencen — para llamar y motivar</div>
            <div className="flex flex-col gap-2.5">
                {filas.map((f, i) => (
                    <div
                        key={f.etiqueta}
                        className="grid grid-cols-[minmax(0,150px)_1fr_52px] items-center gap-2.5 text-[13px]"
                        title={`${f.etiqueta}: ${fmtMiles(f.total)}`}
                    >
                        <span className="truncate">{f.etiqueta}</span>
                        <div className="h-5 overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                            <div
                                className="barra-crece-x h-full rounded-md"
                                style={
                                    {
                                        width: `${(f.total / max) * 100}%`,
                                        background: f.fill,
                                        "--anim-retardo": `${i * 60}ms`,
                                    } as React.CSSProperties
                                }
                            />
                        </div>
                        <span className="cifra text-right font-semibold">{fmtMiles(f.total)}</span>
                    </div>
                ))}
            </div>
            {todoEnCero && (
                <div className="aviso-honesto">
                    Sin vencimientos próximos ni freemium activo en la réplica — nada que llamar por ahora.
                </div>
            )}
        </div>
    );
}
