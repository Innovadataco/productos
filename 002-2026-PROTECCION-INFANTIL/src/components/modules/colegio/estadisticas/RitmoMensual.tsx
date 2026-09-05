"use client";

/**
 * SPEC-158 (T006, US3, FR-005) — Ritmo mensual: la serie mensual reusada de la
 * home (12 puntos, métrica D2) con el patrón de `TendenciaReportes` (AreaChart
 * monotone, un solo color desde tokens, gradiente sutil, tooltip humano,
 * resumen sr-only con el total del periodo). Sin toggle: el tablero fija la
 * lectura mensual ("cada pantalla termina en un verbo", sin cajas de opciones).
 */
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
import { etiquetaPeriodo } from "@/lib/colegio/fechas-humano";

interface RitmoMensualProps {
    puntos: PuntoTendencia[];
    className?: string;
}

const COLOR_SERIE = "rgb(var(--cielo-rgb))";
const COLOR_MALLA = "rgb(var(--tinta-rgb) / 0.08)";
const COLOR_EJE = "rgb(var(--tinta-subtle-rgb))";

interface TooltipPropioProps {
    active?: boolean;
    payload?: { value?: number; payload?: PuntoTendencia }[];
}

function TooltipHumano({ active, payload }: TooltipPropioProps) {
    if (!active || !payload?.length) return null;
    const punto = payload[0];
    const reportes = typeof punto.value === "number" ? punto.value : 0;
    const periodo = punto.payload?.periodo ?? "";
    return (
        <div className="glass-strong rounded-xl px-3 py-2 text-sm text-body shadow-md">
            {reportes} {reportes === 1 ? "reporte" : "reportes"} · {etiquetaPeriodo(periodo, "mensual")}
        </div>
    );
}

export function RitmoMensual({ puntos, className = "" }: RitmoMensualProps) {
    const total = puntos.reduce((suma, punto) => suma + punto.reportes, 0);

    return (
        <section aria-label="Ritmo mensual de reportes" className={`glass flex h-full flex-col rounded-[var(--radio-card)] p-6 sm:p-8 ${className}`}>
            <h2 className="titular-seccion text-body">El ritmo de sus reportes</h2>

            <p className="sr-only" role="status">
                {`Ritmo mensual: ${total} ${total === 1 ? "reporte" : "reportes"} en los últimos 12 meses.`}
            </p>

            <div className="mt-4 min-h-[240px] flex-1">
                <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={puntos} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                        <defs>
                            <linearGradient id="relleno-ritmo-mensual" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={COLOR_SERIE} stopOpacity={0.28} />
                                <stop offset="100%" stopColor={COLOR_SERIE} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke={COLOR_MALLA} />
                        <XAxis
                            dataKey="periodo"
                            tickFormatter={(valor: string) => etiquetaPeriodo(valor, "mensual")}
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
                        <Tooltip content={<TooltipHumano />} cursor={{ stroke: COLOR_MALLA }} />
                        <Area
                            type="monotone"
                            dataKey="reportes"
                            stroke={COLOR_SERIE}
                            strokeWidth={2.5}
                            fill="url(#relleno-ritmo-mensual)"
                            dot={false}
                            activeDot={{ r: 4 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <p className="cifra mt-2 text-sm text-muted">
                Total 12 meses: <span className="font-semibold text-body">{total}</span>{" "}
                {total === 1 ? "reporte" : "reportes"}
            </p>
        </section>
    );
}
