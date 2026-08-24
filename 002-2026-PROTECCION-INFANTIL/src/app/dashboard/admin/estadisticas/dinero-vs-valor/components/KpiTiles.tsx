"use client";

/**
 * SPEC-222 (002-PI-123, US-4): fila de tiles con los KPIs base del negocio.
 * Cada tile muestra el valor del período y su delta vs el período anterior
 * equivalente ("—" cuando no hay base de comparación). Lenguaje descriptivo,
 * sin veredictos.
 */
import type { KpiValor, KpisRespuesta } from "./tipos";

const KPIS: { clave: keyof KpisRespuesta["kpis"]; etiqueta: string; formato: (v: number) => string }[] = [
    { clave: "mau", etiqueta: "Usuarios activos (MAU)", formato: (v) => String(Math.round(v)) },
    { clave: "mrrUSD", etiqueta: "MRR (USD)", formato: (v) => `$${v.toLocaleString("es-CO")}` },
    { clave: "churnRatePct", etiqueta: "Churn del período", formato: (v) => `${v}%` },
    { clave: "ltvUSD", etiqueta: "LTV promedio (USD)", formato: (v) => `$${v.toLocaleString("es-CO")}` },
    { clave: "renovacionesPct", etiqueta: "Renovaciones", formato: (v) => `${v}%` },
    { clave: "conversionFreemiumPct", etiqueta: "Conversión freemium", formato: (v) => `${v}%` },
    { clave: "referidosExitososPct", etiqueta: "Referidos exitosos", formato: (v) => `${v}%` },
];

function Delta({ deltaPct }: { deltaPct: KpiValor["deltaPct"] }) {
    if (deltaPct === null) return <span className="text-xs text-muted">—</span>;
    const positivo = deltaPct >= 0;
    return (
        <span className={`text-xs font-medium ${positivo ? "text-pino" : "text-rubi"}`}>
            {positivo ? "↑" : "↓"} {Math.abs(deltaPct).toFixed(1)}% vs período anterior
        </span>
    );
}

export function KpiTiles({ data }: { data: KpisRespuesta }) {
    return (
        <section aria-label="KPIs del negocio">
            <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold text-body">Panorama del negocio</h2>
                <p className="text-xs text-muted">
                    Período: {data.periodo.desde} → {data.periodo.hasta} ({data.periodo.zona})
                </p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
                {KPIS.map(({ clave, etiqueta, formato }) => (
                    <div key={clave} className="glass rounded-2xl p-4">
                        <p className="text-xs text-muted">{etiqueta}</p>
                        <p className="mt-1 text-xl font-bold text-body">{formato(data.kpis[clave].valor)}</p>
                        <Delta deltaPct={data.kpis[clave].deltaPct} />
                    </div>
                ))}
            </div>
        </section>
    );
}
