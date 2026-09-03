"use client";

import { fmtCOP } from "./formatos";
import type { DeltaKpi } from "./TarjetaKpi";

const CLASES_DELTA: Record<DeltaKpi["tipo"], string> = {
    up: "text-estado-pino",
    down: "text-estado-rubi",
    warn: "text-estado-ambar",
    flat: "text-subtle",
};

/**
 * Tarjeta KPI de dinero (Lote A · Comercial): igual comportamiento que
 * TarjetaKpi pero la cifra se formatea en COP de Colombia (fmtCOP) en vez del
 * count-up genérico — el count-up sobre millones de pesos mareaba y la cifra
 * exacta importa más que la animación. El valor sale del ResultSet tal cual
 * (candados 9 y 10): null → "—", delta "sin comparación" cuando no hay base.
 */
export default function TarjetaKpiDinero({
    etiqueta,
    valor,
    delta,
    retardo,
    brilloNuevo = false,
}: {
    etiqueta: string;
    valor: number | null;
    delta: DeltaKpi;
    retardo: number;
    brilloNuevo?: boolean;
}) {
    return (
        <div
            className={`glass anim-entrada p-6 pb-4 transition-transform duration-300 hover:-translate-y-[3px] ${brilloNuevo ? "brillo-nuevo" : ""}`}
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <div className="microetiqueta">{etiqueta}</div>
            <div className="cifra mb-0.5 mt-1.5 text-[30px] font-bold leading-[1.15] tracking-tight">
                {valor === null ? "—" : fmtCOP(valor)}
            </div>
            <div className={`text-[12.5px] font-semibold ${CLASES_DELTA[delta.tipo]}`}>{delta.texto}</div>
        </div>
    );
}
