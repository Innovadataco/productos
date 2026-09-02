import type { AnaliticaData } from "@/lib/bi/analitica";
import { formatearCategoria } from "@/lib/bi/pulso";
import { fmtMiles } from "@/components/bi/pulso/formatos";

type Severidad = AnaliticaData["riesgoCategorias"][number]["severidad"];

const ESTILO_SEV: Record<Severidad, { fill: string; tag: string; etiqueta: string }> = {
    critica: {
        fill: "rgb(var(--rubi-rgb))",
        tag: "bg-[rgb(var(--rubi-rgb)/0.16)] text-estado-rubi",
        etiqueta: "Crítica",
    },
    alta: {
        fill: "rgb(var(--ambar-rgb))",
        tag: "bg-[rgb(var(--ambar-rgb)/0.16)] text-estado-ambar",
        etiqueta: "Alta",
    },
    vigilar: {
        fill: "rgb(var(--cielo-rgb))",
        tag: "bg-[rgb(var(--cielo-rgb)/0.16)] text-[rgb(var(--cielo-ink-rgb))]",
        etiqueta: "Vigilar",
    },
    baja: {
        fill: "rgb(var(--pino-rgb))",
        tag: "bg-[rgb(var(--pino-rgb)/0.16)] text-estado-pino",
        etiqueta: "Baja",
    },
};

/**
 * Riesgo por categoría (mockup v4, sección 3): frecuencia × severidad, con el
 * fill de la barra y el tag coloreados por la severidad que YA viene resuelta
 * del contrato (rubi/ambar/cielo/pino). El orden lo trae la capa de datos
 * ("las sensibles primero"); aquí no se reordena ni se recalcula (candado 10).
 * Vacío → nota honesta (candado 9).
 */
export default function RiesgoCategorias({
    riesgo,
}: {
    riesgo: AnaliticaData["riesgoCategorias"];
}) {
    const max = Math.max(...riesgo.map((r) => r.total), 1);

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": "180ms" } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[17px] font-semibold">Riesgo por categoría</h3>
            <div className="mb-4 text-[13px] text-muted">Frecuencia × severidad — las sensibles primero</div>
            {riesgo.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay reportes clasificados en la réplica para medir riesgo por categoría.
                </p>
            ) : (
                <div>
                    {riesgo.map((r, i) => {
                        const estilo = ESTILO_SEV[r.severidad];
                        const categoria = formatearCategoria(r.categoria);
                        return (
                            <div
                                key={`${r.categoria}-${i}`}
                                className="grid grid-cols-[minmax(0,190px)_1fr_70px_70px] items-center gap-2.5 border-b border-[rgb(var(--tinta-rgb)/0.06)] py-2 text-[13.5px] last:border-b-0"
                                title={`${categoria}: ${fmtMiles(r.total)} reportes · severidad ${estilo.etiqueta.toLowerCase()}`}
                            >
                                <span className="truncate">{categoria}</span>
                                <div className="h-[22px] overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                                    <div
                                        className="barra-crece-x h-full rounded-md"
                                        style={
                                            {
                                                width: `${(r.total / max) * 100}%`,
                                                background: estilo.fill,
                                                "--anim-retardo": `${i * 60}ms`,
                                            } as React.CSSProperties
                                        }
                                    />
                                </div>
                                <span className="cifra text-right">{fmtMiles(r.total)}</span>
                                <span>
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] ${estilo.tag}`}
                                    >
                                        {estilo.etiqueta}
                                    </span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
