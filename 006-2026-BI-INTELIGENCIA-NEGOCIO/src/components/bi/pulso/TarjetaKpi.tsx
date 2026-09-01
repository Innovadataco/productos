import CifraAnimada from "./CifraAnimada";
import Sparkline from "./Sparkline";

export type DeltaKpi = { texto: string; tipo: "up" | "down" | "warn" | "flat" };

const CLASES_DELTA: Record<DeltaKpi["tipo"], string> = {
    up: "text-estado-pino",
    down: "text-estado-rubi",
    warn: "text-estado-ambar",
    flat: "text-subtle",
};

/**
 * Tarjeta KPI del Pulso (mockup pantalla 2): cifra con count-up (isla
 * client CifraAnimada), delta coloreado — "sin comparación" cuando la capa
 * de datos no trae delta (candado 9: jamás un vs. inventado) — y sparkline
 * de la serie real cuando existe. valor null → "—" (no un cero disfrazado).
 */
export default function TarjetaKpi({
    etiqueta,
    valor,
    decimales = 0,
    unidad,
    delta,
    spark,
    retardo,
    brilloNuevo = false,
}: {
    etiqueta: string;
    valor: number | null;
    decimales?: number;
    unidad?: string;
    delta: DeltaKpi;
    spark?: number[];
    retardo: number;
    /** Barrido de brillo de "recién llegado" (mockup v3: KPI destacado). */
    brilloNuevo?: boolean;
}) {
    return (
        <div
            className={`glass anim-entrada p-6 pb-4 transition-transform duration-300 hover:-translate-y-[3px] ${brilloNuevo ? "brillo-nuevo" : ""}`}
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <div className="microetiqueta">{etiqueta}</div>
            <div className="cifra mb-0.5 mt-1.5 text-[42px] font-bold leading-[1.1] tracking-tight">
                {valor === null ? (
                    "—"
                ) : (
                    <>
                        <CifraAnimada valor={valor} decimales={decimales} />
                        {unidad && <span className="ml-1 text-[18px] font-normal text-muted">{unidad}</span>}
                    </>
                )}
            </div>
            <div className={`text-[12.5px] font-semibold ${CLASES_DELTA[delta.tipo]}`}>{delta.texto}</div>
            {spark && <Sparkline puntos={spark} />}
        </div>
    );
}
