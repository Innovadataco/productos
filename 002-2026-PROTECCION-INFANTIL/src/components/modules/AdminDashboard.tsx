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

    if (loading) return <p className="text-slate-600">Cargando dashboard...</p>;
    if (error) return <p className="text-red-600">{error}</p>;
    if (!data) return null;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>

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
                    <BarChart data={data.porEstado.map((e) => ({ label: formatEstado(e.estado), value: e.count }))} />
                </ChartCard>

                <ChartCard title="Distribución por categoría de conducta">
                    <DonutChart data={data.porCategoria.map((c) => ({ label: formatCategoria(c.categoria), value: c.count }))} />
                </ChartCard>

                <ChartCard title="Distribución por plataforma">
                    <BarChart data={data.porPlataforma.map((p) => ({ label: p.plataforma, value: p.count }))} />
                </ChartCard>

                <ChartCard title="Principales ciudades">
                    <BarChart data={data.porCiudad.map((c) => ({ label: c.ciudad, value: c.count }))} />
                </ChartCard>
            </div>

            <ChartCard title="Tendencia de reportes registrados (últimos 30 días)">
                <Sparkline data={data.tendencia.map((t) => ({ label: t.fecha, value: t.count }))} />
            </ChartCard>
        </div>
    );
}

function MetricCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl border border-white/20 bg-white/70 p-6 backdrop-blur-lg">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
    );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-white/20 bg-white/70 p-6 backdrop-blur-lg">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
            {children}
        </div>
    );
}
