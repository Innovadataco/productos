import { fmtMiles } from "./formatos";

export interface FilaBarraH {
    etiqueta: string;
    total: number;
    /**
     * "rubi": fila en rubí (p. ej. escaladas — pide gestión);
     * "subtle": fila agregada gris (p. ej. "Otras N ciudades");
     * sin acento: gradiente pino→cielo del tema.
     */
    acento?: "rubi" | "subtle";
}

const CLASE_FILL: Record<NonNullable<FilaBarraH["acento"]>, string> = {
    rubi: "bg-[linear-gradient(to_right,rgb(var(--rubi-rgb)),rgb(var(--ambar-rgb)))]",
    subtle: "bg-[rgb(var(--tinta-subtle-rgb))]",
};

/**
 * Barras horizontales compartidas de las pantallas v3 (pulso, personas,
 * geografía): etiqueta a la izquierda, pista con fill animado `barra-crece-x`
 * y cifra real a la derecha. El ancho es relativo al MÁXIMO de las filas
 * (misma convención que GraficoBarras); la cifra impresa es siempre la del
 * ResultSet (candado 10) y el tooltip nativo la repite exacta.
 */
export default function BarrasHorizontales({
    filas,
    retardoBase = 0,
}: {
    filas: FilaBarraH[];
    retardoBase?: number;
}) {
    const max = Math.max(...filas.map((f) => f.total), 1);
    return (
        <div className="flex flex-col gap-2.5">
            {filas.map((f, i) => (
                <div
                    key={`${f.etiqueta}-${i}`}
                    className="grid grid-cols-[minmax(0,150px)_1fr_52px] items-center gap-2.5 text-[13px]"
                    title={`${f.etiqueta}: ${fmtMiles(f.total)}`}
                >
                    <span
                        className={`truncate ${f.acento === "rubi" ? "font-semibold text-estado-rubi" : ""}`}
                    >
                        {f.etiqueta}
                    </span>
                    <div className="h-5 overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                        <div
                            className={`barra-crece-x h-full rounded-md ${f.acento ? CLASE_FILL[f.acento] : "bg-[linear-gradient(to_right,rgb(var(--pino-rgb)),rgb(var(--cielo-rgb)))]"}`}
                            style={
                                {
                                    width: `${(f.total / max) * 100}%`,
                                    "--anim-retardo": `${retardoBase + i * 60}ms`,
                                } as React.CSSProperties
                            }
                        />
                    </div>
                    <span className="cifra text-right font-semibold">{fmtMiles(f.total)}</span>
                </div>
            ))}
        </div>
    );
}
