"use client";

import { useState } from "react";
import type { Reportes360Data } from "@/lib/bi/reportes360";
import { fmtMiles } from "@/components/bi/pulso/formatos";

/** Ventanas del selector de rango (el servidor siempre manda las 24 entradas;
 *  el recorte es en memoria: sin API nueva, sin espera). */
const OPCIONES_MESES = [3, 6, 12, 24] as const;
type MesesFiltro = (typeof OPCIONES_MESES)[number];

const MESES_CORTOS = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
];

/** "2026-03" → "mar"; cualquier otro formato se respeta tal cual (solo presentación). */
function etiquetaMes(mes: string): string {
    const iso = /^\d{4}-(\d{2})/.exec(mes);
    if (iso) {
        const idx = Number(iso[1]) - 1;
        if (idx >= 0 && idx < 12) return MESES_CORTOS[idx];
    }
    return mes.slice(0, 3).toLowerCase();
}

/**
 * Evolución mensual de reportes con SELECTOR DE RANGO 3/6/12/24 meses
 * (mejora pedida por el dueño dentro de "Reportes 360"): el server manda las
 * MESES_EVOLUCION entradas completas (huecos a 0 rellenados en SQL) y este
 * componente recorta la ventana EN MEMORIA — sin fetch, sin fases de carga.
 * Barras con el mismo lenguaje visual de CronologiaAnual (`barra-crece`,
 * gradiente pino→cielo). Candado 9: serie vacía o ventana sin reportes se
 * anuncia con texto honesto; candado 10: las cifras son las del contrato,
 * aquí solo se posicionan y se recorta.
 */
export default function EvolucionMensual({
    serie,
}: {
    serie: Reportes360Data["evolucionMensual"];
}) {
    const [meses, setMeses] = useState<MesesFiltro>(12);
    const ventana = serie.slice(-meses);
    const totalVentana = ventana.reduce((acc, m) => acc + m.total, 0);
    const max = Math.max(...ventana.map((m) => m.total), 1);

    return (
        <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[14.5px] font-semibold">Evolución mensual</h4>
                <div
                    className="flex gap-1.5"
                    role="group"
                    aria-label="Ventana de meses de la evolución"
                >
                    {OPCIONES_MESES.map((op) => (
                        <button
                            key={op}
                            type="button"
                            aria-pressed={meses === op}
                            onClick={() => setMeses(op)}
                            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                                meses === op
                                    ? "border-[rgb(var(--pino-rgb)/0.6)] bg-[rgb(var(--pino-rgb)/0.12)] font-semibold text-body"
                                    : "border-[rgb(var(--tinta-rgb)/0.14)] text-muted hover:border-[rgb(var(--tinta-rgb)/0.3)]"
                            }`}
                        >
                            {op === 24 ? "24 m" : `${op} m`}
                        </button>
                    ))}
                </div>
            </div>
            <div className="mb-4 text-[13px] text-muted">
                {fmtMiles(totalVentana)}{" "}
                {totalVentana === 1 ? "reporte" : "reportes"} en los últimos {meses} meses
            </div>
            {serie.length === 0 ? (
                <p className="py-8 text-center text-[13.5px] text-muted">
                    Aún no hay histórico mensual en la réplica para trazar la evolución.
                </p>
            ) : totalVentana === 0 ? (
                <p className="py-8 text-center text-[13.5px] text-muted">
                    Sin reportes en esta ventana — elige un rango mayor o espera a que llegue
                    actividad.
                </p>
            ) : (
                <div className="flex h-[150px] items-end gap-1 pt-2.5" role="img"
                    aria-label={`Evolución mensual de reportes, últimos ${meses} meses`}>
                    {ventana.map((m, i) => (
                        <div
                            key={`${m.mes}-${i}`}
                            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                            title={`${m.mes}: ${fmtMiles(m.total)} ${m.total === 1 ? "reporte" : "reportes"}`}
                        >
                            <div
                                className="barra-crece min-h-[3px] w-full max-w-[30px] rounded-b-sm rounded-t-md"
                                style={
                                    {
                                        height: `${(m.total / max) * 100}%`,
                                        backgroundImage:
                                            "linear-gradient(to top, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb)))",
                                        "--anim-retardo": `${i * 40}ms`,
                                    } as React.CSSProperties
                                }
                            />
                            <span className="text-[10px] text-subtle">{etiquetaMes(m.mes)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
