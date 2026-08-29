"use client";

/**
 * SPEC-222 (002-PI-123, US-2, FR-013): matriz de dispersión dinero-vs-valor
 * (recharts). X = monto neto USD del período, Y = score de valor. Una serie
 * por cuadrante para color y leyenda: estables=pino, riesgo=rubi,
 * oportunidad=ambar, atención=neutral. Click en punto → vista del cliente
 * (SPEC-211). Tooltip: cliente + monto + score (nunca datos de reportes).
 */
import {
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    Legend,
} from "recharts";
import type { Cuadrante, DispersionRespuesta, PuntoDispersion } from "./tipos";

const COLOR_CUADRANTE: Record<Cuadrante, string> = {
    estables: "rgb(var(--pino-rgb))",
    riesgo: "rgb(var(--rubi-rgb))",
    oportunidad: "rgb(var(--ambar-rgb))",
    atencion: "rgb(var(--tinta-rgb) / 0.45)",
};

const ETIQUETA_CUADRANTE: Record<Cuadrante, string> = {
    estables: "Estables",
    riesgo: "Riesgo",
    oportunidad: "Oportunidad",
    atencion: "Atención",
};

const ORDEN: Cuadrante[] = ["estables", "riesgo", "oportunidad", "atencion"];

interface TooltipPuntoProps {
    active?: boolean;
    payload?: { payload?: PuntoDispersion }[];
}

function TooltipPunto({ active, payload }: TooltipPuntoProps) {
    const punto = active && payload && payload.length > 0 ? payload[0]?.payload : undefined;
    if (!punto) return null;
    return (
        <div className="rounded-xl border border-tinta/15 bg-papel px-3 py-2 text-xs shadow-lg">
            <p className="font-semibold text-body">{punto.cliente}</p>
            <p className="text-muted">
                ${punto.montoUSD.toLocaleString("es-CO")} USD · score {punto.scoreTotal}
            </p>
            <p className="text-muted">{ETIQUETA_CUADRANTE[punto.cuadrante]}</p>
        </div>
    );
}

export function MatrizDispersion({
    data,
    onNavegarCliente,
}: {
    data: DispersionRespuesta;
    onNavegarCliente: (suscripcionId: string) => void;
}) {
    const porCuadrante = new Map<Cuadrante, PuntoDispersion[]>();
    for (const punto of data.puntos) {
        const lista = porCuadrante.get(punto.cuadrante) ?? [];
        lista.push(punto);
        porCuadrante.set(punto.cuadrante, lista);
    }

    return (
        <section className="glass rounded-3xl p-6" aria-label="Matriz dinero vs valor">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <h2 className="text-base font-semibold text-body">Dinero vs Valor</h2>
                    <p className="text-xs text-muted">
                        Cada punto es una suscripción del período: pago acumulado (X) vs score de uso (Y).
                    </p>
                </div>
                <p className="text-xs text-muted">
                    Cortes ({data.cortes.fuente === "mediana" ? "mediana del período" : "parámetros"}): ${data.cortes.montoUSD} USD · score {data.cortes.score}
                </p>
            </div>

            {data.puntos.length === 0 ? (
                <p className="rounded-xl border border-tinta/10 p-4 text-sm text-muted">
                    Sin clientes con score calculado en el período.
                </p>
            ) : (
                <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 12, right: 24, bottom: 12, left: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--tinta-rgb) / 0.12)" />
                            <XAxis
                                type="number"
                                dataKey="montoUSD"
                                name="Monto"
                                tick={{ fontSize: 12 }}
                                label={{ value: "Monto pagado (USD)", position: "insideBottom", offset: -8, fontSize: 12 }}
                            />
                            <YAxis
                                type="number"
                                dataKey="scoreTotal"
                                name="Score"
                                tick={{ fontSize: 12 }}
                                label={{ value: "Score de valor", angle: -90, position: "insideLeft", fontSize: 12 }}
                            />
                            <Tooltip content={<TooltipPunto />} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <ReferenceLine x={data.cortes.montoUSD} stroke="rgb(var(--tinta-rgb) / 0.4)" strokeDasharray="4 4" />
                            <ReferenceLine y={data.cortes.score} stroke="rgb(var(--tinta-rgb) / 0.4)" strokeDasharray="4 4" />
                            {ORDEN.map((cuadrante) => (
                                <Scatter
                                    key={cuadrante}
                                    name={ETIQUETA_CUADRANTE[cuadrante]}
                                    data={porCuadrante.get(cuadrante) ?? []}
                                    fill={COLOR_CUADRANTE[cuadrante]}
                                    cursor="pointer"
                                    onClick={(punto) => {
                                        const payload = (punto as { payload?: PuntoDispersion } | undefined)?.payload;
                                        if (payload) onNavegarCliente(payload.suscripcionId);
                                    }}
                                />
                            ))}
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                {data.sinScore > 0 && <span>{data.sinScore} clientes sin score calculado en el período.</span>}
                {data.truncado && <span>Se muestra una muestra de {data.puntos.length} puntos (límite de la vista).</span>}
            </div>
        </section>
    );
}
