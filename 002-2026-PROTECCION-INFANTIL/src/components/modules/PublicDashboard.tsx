"use client";

import { useState, useEffect } from "react";
import { BarChart } from "./BarChart";
import { DonutChart } from "./DonutChart";
import { MetricCard } from "./MetricCard";
import { ChartCard } from "./ChartCard";
import { MiniList } from "./MiniList";
import { RiskBadge } from "./RiskBadge";
import { formatNivel, formatCategoria, RIESGO_COLORS } from "@/lib/labels";

type StatsData = {
    totales: {
        reportes: number;
        identificadoresUnicos: number;
        reportesAutenticados: number;
        reportesAnonimos: number;
        scorePromedio: number;
    };
    porPlataforma: { plataforma: string; count: number }[];
    porPais: { pais: string; count: number }[];
    porCiudad: { ciudad: string; pais: string; count: number }[];
    porNivelRiesgo: { nivel: string; count: number }[];
    porCategoria: { categoria: string; count: number }[];
    ultimosIdentificadores: {
        identificador: string;
        plataforma: string;
        score: number;
        nivelRiesgo: string;
        totalReportes: number;
        actualizadoEn: string;
    }[];
};

export function PublicDashboard() {
    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/estadisticas-publicas")
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
            <section className="space-y-6" aria-label="Cargando dashboard">
                <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
                    ))}
                </div>
                <div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
            </section>
        );
    }

    if (error) return <p className="text-red-600 dark:text-red-400" role="alert">{error}</p>;
    if (!data) return null;

    const totalOrigen = data.totales.reportesAutenticados + data.totales.reportesAnonimos || 1;
    const topCiudades = data.porCiudad.slice(0, 8).map((c) => ({
        label: `${c.ciudad}, ${c.pais}`,
        count: c.count,
    }));
    const topCiudadesBars = data.porCiudad.slice(0, 5).map((c) => ({
        label: c.ciudad,
        value: c.count,
    }));

    return (
        <section className="space-y-6" aria-labelledby="public-dashboard-title">
            <div>
                <h1 id="public-dashboard-title" className="text-2xl font-bold text-body">
                    Dashboard público
                </h1>
                <p className="text-sm text-muted">
                    Panorama estratégico de reportes en la plataforma. Datos agregados y anonimizados.
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <MetricCard label="Reportes registrados" value={data.totales.reportes} />
                <MetricCard label="Identificadores visibles" value={data.totales.identificadoresUnicos} />
                <MetricCard label="Score promedio" value={data.totales.scorePromedio} suffix="/100" />
                <MetricCard
                    label="Reportes autenticados"
                    value={Math.round((data.totales.reportesAutenticados / totalOrigen) * 100)}
                    suffix="%"
                />
            </div>

            {/* Origen, riesgo y países */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ChartCard title="Origen de reportes" subtitle="Autenticados vs anónimos">
                    <DonutChart
                        ariaLabel="Origen de reportes"
                        data={[
                            { label: "Autenticados", value: data.totales.reportesAutenticados },
                            { label: "Anónimos", value: data.totales.reportesAnonimos },
                        ]}
                    />
                </ChartCard>

                <ChartCard title="Nivel de riesgo" subtitle="Distribución de identificadores">
                    <MiniList
                        items={data.porNivelRiesgo.map((n) => ({
                            label: formatNivel(n.nivel),
                            count: n.count,
                            badgeColor: RIESGO_COLORS[n.nivel],
                            badge: "dot",
                        }))}
                        empty="Sin clasificación de riesgo"
                    />
                </ChartCard>

                <ChartCard title="Top países" subtitle="Cantidad de reportes por país">
                    <MiniList
                        items={data.porPais.map((p) => ({ label: p.pais, count: p.count }))}
                        empty="Sin datos por país"
                    />
                </ChartCard>
            </div>

            {/* Distribución geográfica agregada (sin mapa) */}
            <ChartCard
                title="Reportes por ciudad / departamento"
                subtitle="Datos agregados por ciudad. No incluye direcciones exactas ni datos personales."
            >
                {data.porCiudad.length === 0 ? (
                    <p className="text-sm text-muted">Sin datos geográficos</p>
                ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <MiniList items={topCiudades} empty="Sin datos por ciudad" />
                        <BarChart
                            ariaLabel="Top ciudades por cantidad de reportes"
                            data={topCiudadesBars}
                        />
                    </div>
                )}
            </ChartCard>

            {/* Gráficos */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <ChartCard title="Plataformas más reportadas" subtitle="Distribución por plataforma">
                    {data.porPlataforma.length === 0 ? (
                        <p className="text-sm text-muted">Sin datos</p>
                    ) : (
                        <BarChart
                            ariaLabel="Distribución de reportes por plataforma"
                            data={data.porPlataforma.map((p) => ({ label: p.plataforma, value: p.count }))}
                        />
                    )}
                </ChartCard>

                <ChartCard title="Categorías de conducta" subtitle="Tipo de riesgo más frecuente">
                    {data.porCategoria.length === 0 ? (
                        <p className="text-sm text-muted">Sin datos</p>
                    ) : (
                        <DonutChart
                            ariaLabel="Distribución de reportes por categoría"
                            data={data.porCategoria.map((c) => ({ label: formatCategoria(c.categoria), value: c.count }))}
                        />
                    )}
                </ChartCard>
            </div>

            {/* Últimos identificadores */}
            <ChartCard title="Últimos identificadores reportados" subtitle="Identificadores recientemente visibles públicamente">
                {data.ultimosIdentificadores.length === 0 ? (
                    <p className="text-sm text-muted">Sin identificadores visibles recientemente</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100/70 text-subtle dark:bg-slate-800/60">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Identificador</th>
                                    <th className="px-4 py-3 font-medium">Plataforma</th>
                                    <th className="px-4 py-3 font-medium">Score</th>
                                    <th className="px-4 py-3 font-medium">Riesgo</th>
                                    <th className="px-4 py-3 font-medium text-right">Reportes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data.ultimosIdentificadores.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                                    >
                                        <td className="px-4 py-3 font-mono text-body">{item.identificador}</td>
                                        <td className="px-4 py-3 text-body">{item.plataforma}</td>
                                        <td className="px-4 py-3 text-body">{item.score}/100</td>
                                        <td className="px-4 py-3">
                                            <RiskBadge nivel={item.nivelRiesgo} />
                                        </td>
                                        <td className="px-4 py-3 text-right text-body">{item.totalReportes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </ChartCard>

            {/* Resumen agregado */}
            <ChartCard title="Resumen de actividad" subtitle="Datos agregados de la plataforma">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="glass rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-body">{data.totales.reportes}</p>
                        <p className="text-xs text-subtle">Reportes totales</p>
                    </div>
                    <div className="glass rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-body">{data.totales.identificadoresUnicos}</p>
                        <p className="text-xs text-subtle">Identificadores distintos</p>
                    </div>
                    <div className="glass rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-body">{data.porPais.length}</p>
                        <p className="text-xs text-subtle">Países</p>
                    </div>
                    <div className="glass rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-body">{data.porCiudad.length}</p>
                        <p className="text-xs text-subtle">Ciudades</p>
                    </div>
                </div>
            </ChartCard>
        </section>
    );
}
