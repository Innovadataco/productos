"use client";

import { useState, useEffect } from "react";
import { BarChart } from "./BarChart";
import { DonutChart } from "./DonutChart";
import { Sparkline } from "./Sparkline";
import { ErrorState } from "@/components/ui/ErrorState";

 type StatsData = {
    totales: {
        reportes: number;
        reportesHoy: number;
        pendientesRevision: number;
        pendientesAnonimizacion: number;
        reportesAnonimos: number;
        reportesAutenticados: number;
    };
    porEstado: { estado: string; count: number }[];
    porCategoria: { categoria: string; count: number }[];
    porPlataforma: { plataforma: string; count: number }[];
    porCiudad: { ciudad: string; count: number }[];
    tendencia: { fecha: string; count: number }[];
    precisionPorCategoria: {
        categoria: string;
        confirmadas: number;
        corregidas: number;
        totalRevisados: number;
        precisionObservada: number | null;
    }[];
    worker: {
        conteosPorEstado: Record<string, number>;
        enCola: number;
        activos: number;
        estancados: number;
        completados: number;
        fallidos: number;
        latenciaPromedioMs: number;
        tasaExito: number;
        totalJobs: number;
    } | null;
};

const CATEGORIA_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado por IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    OTRO: "Otro",
};

function formatEstado(estado: string) {
    return estado.replace(/_/g, " ");
}

function formatCategoria(categoria: string) {
    return CATEGORIA_LABELS[categoria] || categoria;
}

export function AdminDashboard() {
    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/admin/estadisticas", { credentials: "include" })
            .then(async (r) => {
                if (!r.ok) throw new Error("Error cargando estadísticas");
                return r.json();
            })
            .then(setData)
            .catch(() => setError("Error cargando estadísticas"))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="space-y-6" aria-busy="true" aria-label="Cargando dashboard">
                <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) return <ErrorState title="No pudimos cargar las estadísticas" description="Ocurrió un problema al consultar el dashboard. Intenta recargar la página." onRetry={() => window.location.reload()} />;
    if (!data) return null;

    return (
        <section className="space-y-8" aria-labelledby="dashboard-title">
            <div>
                <h1 id="dashboard-title" className="text-2xl font-bold text-body">Dashboard</h1>
                <p className="mt-1 text-sm text-muted">Resumen de reportes, categorías y operación de la plataforma.</p>
            </div>

            <section className="space-y-4" aria-labelledby="metrics-title">
                <h2 id="metrics-title" className="text-lg font-semibold text-body">Métricas principales</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <MetricCard label="Reportes registrados" value={data.totales.reportes} />
                    <MetricCard label="Reportes registrados hoy" value={data.totales.reportesHoy} />
                    <MetricCard label="Pendientes de revisión" value={data.totales.pendientesRevision} />
                    <MetricCard label="Pendientes de anonimización" value={data.totales.pendientesAnonimizacion} />
                    <MetricCard label="Reportes anónimos" value={data.totales.reportesAnonimos} />
                    <MetricCard label="Reportes autenticados" value={data.totales.reportesAutenticados} />
                </div>
            </section>

            <section className="space-y-4" aria-labelledby="charts-title">
                <h2 id="charts-title" className="text-lg font-semibold text-body">Distribución</h2>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ChartCard title="Distribución por estado">
                    <BarChart
                        ariaLabel="Distribución de reportes por estado"
                        data={data.porEstado.map((e) => ({ label: formatEstado(e.estado), value: e.count }))}
                    />
                </ChartCard>

                <ChartCard title="Distribución por categoría de conducta">
                    <DonutChart
                        ariaLabel="Distribución de reportes por categoría de conducta"
                        data={data.porCategoria.map((c) => ({ label: formatCategoria(c.categoria), value: c.count }))}
                    />
                </ChartCard>

                <ChartCard title="Distribución por plataforma">
                    <BarChart
                        ariaLabel="Distribución de reportes por plataforma"
                        data={data.porPlataforma.map((p) => ({ label: p.plataforma, value: p.count }))}
                    />
                </ChartCard>

                <ChartCard title="Principales ciudades">
                    <BarChart
                        ariaLabel="Principales ciudades con reportes"
                        data={data.porCiudad.map((c) => ({ label: c.ciudad, value: c.count }))}
                    />
                </ChartCard>
            </div>

            <ChartCard title="Tendencia de reportes registrados (últimos 30 días)">
                <Sparkline
                    ariaLabel="Tendencia de reportes registrados en los últimos 30 días"
                    data={data.tendencia.map((t) => ({ label: t.fecha, value: t.count }))}
                />
            </ChartCard>
            </section>

            <PrecisionTable precisionPorCategoria={data.precisionPorCategoria} />

            {data.worker && (
                <section className="space-y-6" aria-labelledby="worker-title">
                    <h2 id="worker-title" className="text-xl font-bold text-body">Cola de procesamiento</h2>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <MetricCard label="En cola" value={data.worker.enCola} />
                        <MetricCard label="Activos" value={data.worker.activos} />
                        <MetricCard label="Estancados" value={data.worker.estancados} />
                        <MetricCard label="Completados" value={data.worker.completados} />
                        <MetricCard label="Fallidos" value={data.worker.fallidos} />
                        <MetricCard label="Latencia promedio (ms)" value={data.worker.latenciaPromedioMs} />
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <ChartCard title="Distribución de jobs por estado">
                            <DonutChart
                                ariaLabel="Distribución de jobs por estado"
                                data={Object.entries(data.worker.conteosPorEstado).map(([estado, value]) => ({
                                    label: formatEstado(estado),
                                    value,
                                }))}
                            />
                        </ChartCard>

                        <ChartCard title="Tasa de éxito">
                            <div className="flex flex-col items-center justify-center py-8">
                                <p className="text-5xl font-bold text-accent">{data.worker.tasaExito}%</p>
                                <p className="mt-2 text-sm text-muted">{data.worker.completados} éxitos / {data.worker.completados + data.worker.fallidos} terminados</p>
                            </div>
                        </ChartCard>
                    </div>
                </section>
            )}
        </section>
    );
}

function MetricCard({ label, value }: { label: string; value: number }) {
    return (
        <article className="glass rounded-2xl p-6 transition hover:shadow-md motion-reduce:transition-none">
            <p className="text-sm font-medium text-muted">{label}</p>
            <p className="mt-2 text-3xl font-bold text-body">{value}</p>
        </article>
    );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <article className="glass rounded-2xl p-6">
            <h2 className="mb-4 text-lg font-semibold text-body">{title}</h2>
            {children}
        </article>
    );
}

function precisionColorClass(value: number): string {
    if (value < 0.7) return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300";
    if (value < 0.9) return "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
    return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300";
}

function PrecisionTable({
    precisionPorCategoria,
}: {
    precisionPorCategoria: StatsData["precisionPorCategoria"];
}) {
    return (
        <ChartCard title="Precisión observada por categoría (solo casos revisados)">
            <p className="mb-4 text-sm text-muted">
                Esta métrica solo incluye reportes revisados por un admin (confirmados + corregidas).
                No estima la precisión global del clasificador.
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-subtle">
                        <tr>
                            <th className="px-4 py-3 font-medium">Categoría</th>
                            <th className="px-4 py-3 font-medium">Confirmadas</th>
                            <th className="px-4 py-3 font-medium">Corregidas</th>
                            <th className="px-4 py-3 font-medium">Total revisados</th>
                            <th className="px-4 py-3 font-medium">Precisión observada</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {precisionPorCategoria.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-6 text-center text-subtle">
                                    Aún no hay correcciones ni confirmaciones registradas.
                                </td>
                            </tr>
                        ) : (
                            precisionPorCategoria.map((row) => (
                                <tr key={row.categoria}>
                                    <td className="px-4 py-3 text-body">{formatCategoria(row.categoria)}</td>
                                    <td className="px-4 py-3 text-body">{row.confirmadas}</td>
                                    <td className="px-4 py-3 text-body">{row.corregidas}</td>
                                    <td className="px-4 py-3 text-body">{row.totalRevisados}</td>
                                    <td className="px-4 py-3">
                                        {row.precisionObservada === null ? (
                                            <span className="text-subtle">Insuficientes datos (&lt; 5)</span>
                                        ) : (
                                            <span
                                                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${precisionColorClass(
                                                    row.precisionObservada
                                                )}`}
                                            >
                                                {(row.precisionObservada * 100).toFixed(1)}%
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </ChartCard>
    );
}
