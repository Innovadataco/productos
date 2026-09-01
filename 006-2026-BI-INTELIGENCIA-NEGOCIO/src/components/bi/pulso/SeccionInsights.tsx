import Link from "next/link";
import type { Insight } from "@/lib/bi/insights";

/* Etiqueta y color por severidad (borde izquierdo de 4px, como el mockup). */
const SEVERIDAD = {
    ambar: {
        etiqueta: "⚠ Atención",
        claseTexto: "text-estado-ambar",
        claseBorde: "bg-[rgb(var(--ambar-rgb))]",
    },
    cielo: {
        etiqueta: "◆ Hallazgo",
        claseTexto: "text-[rgb(var(--cielo-ink-rgb))]",
        claseBorde: "bg-[rgb(var(--cielo-rgb))]",
    },
    pino: {
        etiqueta: "✓ Buena noticia",
        claseTexto: "text-estado-pino",
        claseBorde: "bg-[rgb(var(--pino-rgb))]",
    },
} as const;

/**
 * "BI detectó · sin que le preguntes" — insights PROACTIVOS reales de la
 * capa de datos. Si no hay insights la sección entera no se renderiza
 * (candado 9: nada de hallazgos de relleno). El primero (más reciente)
 * lleva el barrido de brillo de "nuevo".
 */
export default function SeccionInsights({ insights }: { insights: Insight[] }) {
    if (insights.length === 0) return null;
    const hayAtencion = insights.some((i) => i.severidad === "ambar");

    return (
        <section aria-label="Hallazgos detectados por BI">
            <div
                className="microetiqueta anim-entrada mb-3 flex items-center gap-2"
                style={{ "--anim-retardo": "220ms" } as React.CSSProperties}
            >
                <span className={`punto anim-pulso ${hayAtencion ? "punto-warn" : "punto-ok"}`} />
                BI detectó · sin que le preguntes
            </div>
            <div className="mb-7 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
                {insights.map((insight, i) => {
                    const sev = SEVERIDAD[insight.severidad];
                    return (
                        <article
                            key={`${insight.titulo}-${i}`}
                            className={`glass anim-entrada relative overflow-hidden p-5 pl-6 transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[var(--sombra-md)] ${
                                i === 0 ? "brillo-nuevo" : ""
                            }`}
                            style={{ "--anim-retardo": `${260 + i * 60}ms` } as React.CSSProperties}
                        >
                            <span aria-hidden="true" className={`absolute bottom-0 left-0 top-0 w-1 ${sev.claseBorde}`} />
                            <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${sev.claseTexto}`}>
                                {sev.etiqueta}
                            </span>
                            <h4 className="mb-1.5 mt-2 text-[16.5px] font-semibold leading-snug">{insight.titulo}</h4>
                            <p className="text-[13.5px] leading-relaxed text-muted">{insight.detalle}</p>
                            {insight.accion && (
                                <div className="mt-3.5">
                                    <Link
                                        href={insight.accion.href}
                                        className="inline-flex items-center rounded-full border border-[rgb(var(--tinta-rgb)/0.14)] px-3.5 py-1.5 text-[12.5px] font-semibold transition-all hover:bg-[rgb(var(--tinta-rgb)/0.07)]"
                                    >
                                        {insight.accion.etiqueta}
                                    </Link>
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
