"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { BarChart } from "./BarChart";
import { DonutChart } from "./DonutChart";
import { MetricCard } from "./MetricCard";
import { ChartCard } from "./ChartCard";
import { MiniList } from "./MiniList";
import { formatNivel, RIESGO_COLORS } from "@/lib/labels";
import type { PuntoMapa } from "./MapaUbicaciones";

const MapaUbicaciones = dynamic(
    () => import("./MapaUbicaciones").then((mod) => mod.MapaUbicaciones),
    { ssr: false }
);

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
    porCiudad: { ciudad: string; pais: string; count: number; lat: number | null; lng: number | null }[];
    porNivelRiesgo: { nivel: string; count: number }[];
    porCategoria: { categoria: string; count: number }[];
    porGrupoCategoria: { clave: string; nombre: string; orden: number; total: number }[];
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

    const puntosMapa: PuntoMapa[] = data.porCiudad
        .filter((c) => typeof c.lat === "number" && typeof c.lng === "number")
        .map((c) => ({
            lat: c.lat as number,
            lng: c.lng as number,
            label: `${c.ciudad}, ${c.pais}`,
            total: c.count,
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

            {/* Mapa de calor por ciudad */}
            <ChartCard
                title="Reportes por ciudad / departamento"
                subtitle="Mapa de calor aproximado por ciudad. No incluye direcciones exactas ni datos personales."
            >
                {puntosMapa.length === 0 && data.porPais.length === 0 ? (
                    <p className="text-sm text-muted">Sin datos geográficos</p>
                ) : (
                    <MapaUbicaciones
                        puntos={puntosMapa}
                        paises={data.porPais.map((p) => ({ pais: p.pais, total: p.count }))}
                    />
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
                    {data.porGrupoCategoria.length === 0 ? (
                        <p className="text-sm text-muted">Sin datos</p>
                    ) : (
                        <DonutChart
                            ariaLabel="Distribución de reportes por categoría"
                            data={data.porGrupoCategoria.map((g) => ({ label: g.nombre, value: g.total }))}
                        />
                    )}
                </ChartCard>
            </div>
        </section>
    );
}
