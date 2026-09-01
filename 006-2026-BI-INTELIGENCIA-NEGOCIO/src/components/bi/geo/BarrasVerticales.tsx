import { fmtMiles } from "../pulso/formatos";

export interface PuntoVertical {
    /** Etiqueta corta del eje ("L", "sep") */
    etiqueta: string;
    total: number;
    /** Texto completo del tooltip (default: etiqueta) */
    titulo?: string;
}

/**
 * Barras verticales compartidas de Geografía (estacionalidad semanal y
 * cronología mensual): misma técnica que GraficoBarras del Pulso — altura
 * real en el estilo inline, animación `barra-crece` escalonada, tooltip
 * nativo con el total exacto. Las cifras vienen del ResultSet; los huecos
 * (días/meses en 0) se ven en 0, no se disimulan (candado 9).
 */
export default function BarrasVerticales({
    puntos,
    retardoBase = 0,
}: {
    puntos: PuntoVertical[];
    retardoBase?: number;
}) {
    const max = Math.max(...puntos.map((p) => p.total), 1);
    return (
        <div className="flex h-[130px] items-end gap-1.5 pt-2.5">
            {puntos.map((p, i) => (
                <div
                    key={`${p.etiqueta}-${i}`}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                    title={`${fmtMiles(p.total)} ${p.total === 1 ? "reporte" : "reportes"} · ${p.titulo ?? p.etiqueta}`}
                >
                    <span className="cifra text-[11px] font-semibold">{fmtMiles(p.total)}</span>
                    <div
                        className="barra-crece min-h-[3px] w-full max-w-[34px] rounded-b-sm rounded-t-md"
                        style={
                            {
                                height: `${(p.total / max) * 100}%`,
                                backgroundImage:
                                    "linear-gradient(to top, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                "--anim-retardo": `${retardoBase + i * 55}ms`,
                            } as React.CSSProperties
                        }
                    />
                    <span className="text-[10px] text-subtle">{p.etiqueta}</span>
                </div>
            ))}
        </div>
    );
}
