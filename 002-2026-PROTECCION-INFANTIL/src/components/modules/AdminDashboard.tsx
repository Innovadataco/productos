"use client";

import { useState, useEffect } from "react";
import { BarChart } from "./BarChart";
import { DonutChart } from "./DonutChart";
import { Sparkline } from "./Sparkline";

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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setLoading(true);
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

    if (error) return <p className="text-red-600" role="alert">{error}</p>;
    if (!data) return null;

    return (
        <section className="space-y-6" aria-labelledby="dashboard-title">
            <h1 id="dashboard-title" className="text-2xl font-bold text-slate-900">Dashboard</h1>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard label="Reportes registrados" value={data.totales.reportes} />
                <MetricCard label="Reportes registrados hoy" value={data.totales.reportesHoy} />
                <MetricCard label="Pendientes de revisión" value={data.totales.pendientesRevision} />
                <MetricCard label="Pendientes de anonimización" value={data.totales.pendientesAnonimizacion} />
                <MetricCard label="Reportes anónimos" value={data.totales.reportesAnonimos} />
                <MetricCard label="Reportes autenticados" value={data.totales.reportesAutenticados} />
            </div>

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

            {data.worker && (
                <section className="space-y-6" aria-labelledby="worker-title">
                    <h2 id="worker-title" className="text-xl font-bold text-slate-900">Cola de procesamiento</h2>

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
                                <p className="text-5xl font-bold text-primary-600">{data.worker.tasaExito}%</p>
                                <p className="mt-2 text-sm text-slate-500">{data.worker.completados} éxitos / {data.worker.completados + data.worker.fallidos} terminados</p>
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
        <article className="rounded-2xl border border-white/20 bg-white/70 p-6 backdrop-blur-lg transition hover:shadow-md motion-reduce:transition-none">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </article>
    );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <article className="rounded-2xl border border-white/20 bg-white/70 p-6 backdrop-blur-lg">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
            {children}
        </article>
    );
}
