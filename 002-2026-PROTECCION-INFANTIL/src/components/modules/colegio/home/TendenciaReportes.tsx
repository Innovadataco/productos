"use client";

/**
 * SPEC-143 (US3, FR-006) — Tendencia de reportes (Recharts, client component).
 * Las TRES series llegan por props (12 semanas + 12 meses + 3 años, ~27 puntos):
 * el toggle repinta en cliente SIN refetch. Un solo color por serie desde tokens
 * (cielo), gradiente sutil bajo la línea, tooltip humano ("3 reportes · sep 2026")
 * y resumen textual accesible (sr-only) con el total del periodo visible.
 */
import { useState } from "react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";
import type { PuntoTendencia } from "@/lib/dal/repositories/colegio-resumen";
import { etiquetaPeriodo, type GranularidadTendencia } from "@/lib/colegio/fechas-humano";

interface TendenciaReportesProps {
    semanal: PuntoTendencia[];
    mensual: PuntoTendencia[];
    anual: PuntoTendencia[];
    className?: string;
}

const OPCIONES: { clave: GranularidadTendencia; etiqueta: string }[] = [
    { clave: "semanal", etiqueta: "Semanal" },
    { clave: "mensual", etiqueta: "Mensual" },
    { clave: "anual", etiqueta: "Anual" },
];

const COLOR_SERIE = "rgb(var(--cielo-rgb))";
const COLOR_MALLA = "rgb(var(--tinta-rgb) / 0.08)";
const COLOR_EJE = "rgb(var(--tinta-subtle-rgb))";

interface TooltipPropioProps {
    active?: boolean;
    payload?: { value?: number; payload?: PuntoTendencia }[];
    granularidad: GranularidadTendencia;
}

function TooltipHumano({ active, payload, granularidad }: TooltipPropioProps) {
    if (!active || !payload?.length) return null;
    const punto = payload[0];
    const reportes = typeof punto.value === "number" ? punto.value : 0;
    const periodo = punto.payload?.periodo ?? "";
    return (
        <div className="glass-strong rounded-xl px-3 py-2 text-sm text-body shadow-md">
            {reportes} {reportes === 1 ? "reporte" : "reportes"} · {etiquetaPeriodo(periodo, granularidad)}
        </div>
    );
}

export function TendenciaReportes({ semanal, mensual, anual, className = "" }: TendenciaReportesProps) {
    const [granularidad, setGranularidad] = useState<GranularidadTendencia>("semanal");

    const series: Record<GranularidadTendencia, PuntoTendencia[]> = { semanal, mensual, anual };
    const datos = series[granularidad];
    const total = datos.reduce((suma, punto) => suma + punto.reportes, 0);
    const etiquetaTotal = granularidad === "semanal" ? "12 semanas" : granularidad === "mensual" ? "12 meses" : "3 años";

    return (
        <section aria-label="Tendencia de reportes" className={`glass flex h-full flex-col rounded-[var(--radio-card)] p-6 sm:p-8 ${className}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="titular-seccion text-body">Tendencia de reportes</h2>
                <div role="group" aria-label="Periodo de la tendencia" className="flex gap-1">
                    {OPCIONES.map((opcion) => {
                        const activa = granularidad === opcion.clave;
                        return (
                            <button
                                key={opcion.clave}
                                type="button"
                                aria-pressed={activa}
                                onClick={() => setGranularidad(opcion.clave)}
                                className={`min-h-12 rounded-xl px-4 py-2 text-sm font-medium transition ${
                                    activa ? "accent-gradient text-white shadow-sm" : "text-muted hover:text-body"
                                }`}
                            >
                                {opcion.etiqueta}
                            </button>
                        );
                    })}
                </div>
            </div>

            <p className="sr-only" role="status">
                {`Periodo ${granularidad}: ${total} ${total === 1 ? "reporte" : "reportes"} en las últimas ${etiquetaTotal}.`}
            </p>

            <div className="mt-4 min-h-[260px] flex-1">
                <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                        <defs>
                            <linearGradient id="relleno-tendencia" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={COLOR_SERIE} stopOpacity={0.28} />
                                <stop offset="100%" stopColor={COLOR_SERIE} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke={COLOR_MALLA} />
                        <XAxis
                            dataKey="periodo"
                            tickFormatter={(valor: string) => etiquetaPeriodo(valor, granularidad)}
                            tick={{ fill: COLOR_EJE, fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                            minTickGap={24}
                        />
                        <YAxis
                            allowDecimals={false}
                            tick={{ fill: COLOR_EJE, fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<TooltipHumano granularidad={granularidad} />} cursor={{ stroke: COLOR_MALLA }} />
                        <Area
                            type="monotone"
                            dataKey="reportes"
                            stroke={COLOR_SERIE}
                            strokeWidth={2.5}
                            fill="url(#relleno-tendencia)"
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <p className="cifra mt-2 text-sm text-muted">
                Total {etiquetaTotal}: <span className="font-semibold text-body">{total}</span>{" "}
                {total === 1 ? "reporte" : "reportes"}
            </p>
        </section>
    );
}
