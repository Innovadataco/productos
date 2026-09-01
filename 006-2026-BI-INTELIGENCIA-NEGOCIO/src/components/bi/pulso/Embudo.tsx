import { fmtMiles } from "./formatos";

export interface PasoEmbudo {
    etiqueta: string;
    total: number;
}

/**
 * Embudo compartido de las pantallas v3 (círculo de confianza, reincidencia,
 * inter-ciudad): cada paso muestra su cifra REAL y un fill cuyo ancho es la
 * proporción contra `base` (por defecto el primer paso — semántica de
 * embudo). Si base es 0 todos los anchos son 0: el vacío se ve vacío, no se
 * disfraza (candado 9). La cifra impresa es siempre la del ResultSet.
 */
export default function Embudo({
    pasos,
    base,
    retardoBase = 0,
}: {
    pasos: PasoEmbudo[];
    /** Referencia del 100%. Default: el total del primer paso. */
    base?: number;
    retardoBase?: number;
}) {
    const referencia = base ?? pasos[0]?.total ?? 0;
    return (
        <div className="flex flex-col gap-2.5">
            {pasos.map((p, i) => (
                <div
                    key={`${p.etiqueta}-${i}`}
                    className="grid grid-cols-[minmax(0,170px)_1fr_60px] items-center gap-3 text-[13.5px]"
                    title={`${p.etiqueta}: ${fmtMiles(p.total)}`}
                >
                    <span className="truncate">{p.etiqueta}</span>
                    <div className="h-[26px] overflow-hidden rounded-lg bg-[rgb(var(--tinta-rgb)/0.06)]">
                        <div
                            className="barra-crece-x h-full rounded-lg bg-[linear-gradient(to_right,rgb(var(--cielo-rgb)),rgb(var(--pino-rgb)))]"
                            style={
                                {
                                    width: `${referencia > 0 ? Math.min((p.total / referencia) * 100, 100) : 0}%`,
                                    "--anim-retardo": `${retardoBase + i * 60}ms`,
                                } as React.CSSProperties
                            }
                        />
                    </div>
                    <span className="cifra text-right font-bold">{fmtMiles(p.total)}</span>
                </div>
            ))}
        </div>
    );
}
