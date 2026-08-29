import { GlassCard } from "@/components/ui/GlassCard";
import type { KpiPagosDto } from "@/lib/pagos/analitica.service";

/**
 * SPEC-218 (002-PI-118): fila superior de KPIs del dashboard dinero-vs-valor
 * (BRIEF §9.2, FR-004). Presentacional (server component); paleta ambar (D-74).
 */

function formatoUSD(valor: number | null): string {
    if (valor === null) return "—";
    return `US$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(valor)}`;
}

function formatoPct(valor: number | null): string {
    if (valor === null) return "—";
    return `${valor}%`;
}

interface KpiItem {
    clave: string;
    label: string;
    valor: string;
    detalle?: string;
    /** Semáforo de la variación: sube = pino, baja = rubi, neutro = ambar. */
    tono?: "pino" | "rubi" | "ambar" | undefined;
}

export function KpiPagosCards({ kpi }: { kpi: KpiPagosDto }) {
    const variacion = kpi.variacionRecaudoPct;
    const items: KpiItem[] = [
        {
            clave: "recaudo",
            label: "Recaudo del mes",
            valor: formatoUSD(kpi.recaudoMesActualUSD),
            detalle: `Mes anterior: ${formatoUSD(kpi.recaudoMesAnteriorUSD)}`,
            tono: variacion === null ? "ambar" : variacion > 0 ? "pino" : variacion < 0 ? "rubi" : "ambar",
        },
        { clave: "activas", label: "Suscripciones activas", valor: String(kpi.activas) },
        { clave: "en-gracia", label: "En gracia", valor: String(kpi.enGracia), tono: kpi.enGracia > 0 ? "ambar" : undefined },
        { clave: "suspendidas", label: "Suspendidas", valor: String(kpi.suspendidas), tono: kpi.suspendidas > 0 ? "rubi" : undefined },
        { clave: "nuevas", label: "Nuevas del mes", valor: String(kpi.nuevasEsteMes) },
        { clave: "renovaciones", label: "Renovaciones del mes", valor: String(kpi.renovacionesEsteMes) },
        { clave: "ticket", label: "Ticket promedio", valor: formatoUSD(kpi.ticketPromedioUSD) },
        { clave: "ltv", label: "LTV por cliente", valor: formatoUSD(kpi.ltvUSD) },
        { clave: "conversion", label: "Conversión freemium", valor: formatoPct(kpi.conversionFreemiumPct) },
        { clave: "referidos", label: "Tasa de referidos", valor: formatoPct(kpi.tasaReferidosPct) },
    ];

    return (
        <section aria-labelledby="kpi-pagos-title" className="space-y-3">
            <div className="flex items-center justify-between gap-4">
                <h2 id="kpi-pagos-title" className="text-lg font-semibold text-body">
                    Panorama de recaudo
                </h2>
                {variacion !== null && (
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                            variacion >= 0
                                ? "bg-pino/10 text-pino dark:bg-pino/20"
                                : "bg-rubi/10 text-rubi dark:bg-rubi/20"
                        }`}
                    >
                        {variacion >= 0 ? "+" : ""}
                        {variacion}% vs mes anterior
                    </span>
                )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {items.map((item) => (
                    <GlassCard key={item.clave} className="p-5">
                        <p className="text-xs text-muted">{item.label}</p>
                        <p
                            className={`mt-1 text-2xl font-bold ${
                                item.tono === "rubi"
                                    ? "text-rubi"
                                    : item.tono === "pino"
                                        ? "text-pino"
                                        : item.tono === "ambar"
                                            ? "text-estado-ambar dark:text-ambar"
                                            : "text-body"
                            }`}
                        >
                            {item.valor}
                        </p>
                        {item.detalle && <p className="mt-1 text-xs text-muted">{item.detalle}</p>}
                    </GlassCard>
                ))}
            </div>
        </section>
    );
}
