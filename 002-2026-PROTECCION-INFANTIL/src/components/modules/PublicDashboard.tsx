"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { BarChart } from "./BarChart";
import { DonutChart } from "./DonutChart";

const MapaPuntos = dynamic(
    () => import("./MapaPuntos").then((mod) => ({ default: mod.MapaPuntos })),
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
    porCiudad: { ciudad: string; pais: string; lat: number | null; lng: number | null; count: number }[];
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

const RIESGO_LABELS: Record<string, string> = {
    BAJO: "Bajo",
    MEDIO: "Medio",
    ALTO: "Alto",
    CRITICO: "Crítico",
    SIN_CLASIFICAR: "Sin clasificar",
};

const RIESGO_COLORS: Record<string, string> = {
    BAJO: "bg-emerald-500",
    MEDIO: "bg-amber-500",
    ALTO: "bg-orange-500",
    CRITICO: "bg-red-500",
    SIN_CLASIFICAR: "bg-slate-400",
};

const CATEGORIAS_LABELS: Record<string, string> = {
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

function formatNivel(nivel: string) {
    return RIESGO_LABELS[nivel] || nivel;
}

function formatCategoria(categoria: string) {
    return CATEGORIAS_LABELS[categoria] || categoria;
}

function MetricCard({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
    return (
        <article className="glass rounded-2xl p-5 text-center transition hover:scale-[1.02]">
            <p className="text-sm font-medium text-muted">{label}</p>
            <p className="mt-2 text-3xl font-bold text-body">
                {value.toLocaleString("es-CO")}
                {suffix && <span className="text-lg">{suffix}</span>}
            </p>
        </article>
    );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <article className="glass rounded-2xl p-5 transition hover:scale-[1.01]">
            <h2 className="text-base font-semibold text-body">{title}</h2>
            {subtitle && <p className="mb-3 text-xs text-subtle">{subtitle}</p>}
            {children}
        </article>
    );
}

function MiniList({ items, empty }: { items: { label: string; count: number; badge?: string; badgeColor?: string }[]; empty: string }) {
    if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
    const max = Math.max(...items.map((i) => i.count), 1);
    return (
        <div className="space-y-3">
            {items.slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                    <div className="flex-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-body">
                                {item.badge && <span className={`inline-block h-2 w-2 rounded-full ${item.badgeColor || "bg-sky-500"}`} />}
                                {item.label}
                            </span>
                            <span className="font-semibold text-body">{item.count}</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                                style={{ width: `${(item.count / max) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

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

    const puntosMapa = data.porCiudad
        .filter((c) => c.lat != null && c.lng != null)
        .map((c) => ({
            lat: c.lat as number,
            lng: c.lng as number,
            label: c.ciudad,
            sub: c.pais,
            count: c.count,
        }));

    const totalOrigen = data.totales.reportesAutenticados + data.totales.reportesAnonimos || 1;

    return (
        <section className="space-y-5" aria-labelledby="public-dashboard-title">
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
                <MetricCard label="Reportes" value={data.totales.reportes} />
                <MetricCard label="Identificadores" value={data.totales.identificadoresUnicos} />
                <MetricCard label="Score promedio" value={data.totales.scorePromedio} suffix="/100" />
                <MetricCard label="Autenticados" value={Math.round((data.totales.reportesAutenticados / totalOrigen) * 100)} suffix="%" />
            </div>

            {/* Origen de reportes mini */}
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

                <ChartCard title="Top países" subtitle="Cantidad de reportes por país">
                    <MiniList
                        items={data.porPais.map((p) => ({ label: p.pais, count: p.count }))}
                        empty="Sin datos por país"
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
            </div>

            {/* Mapa */}
            <MapaPuntos
                puntos={puntosMapa}
                title="Mapa de reportes por ciudad"
                subtitle="Cada punto representa una ciudad con la cantidad de reportes. No incluye direcciones exactas ni datos personales."
            />

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

            {/* Resumen agregado */}
            <ChartCard title="Resumen de actividad" subtitle="Datos agregados de la plataforma">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-xl glass p-4 text-center">
                        <p className="text-2xl font-bold text-body">{data.totales.reportes}</p>
                        <p className="text-xs text-subtle">Reportes totales</p>
                    </div>
                    <div className="rounded-xl glass p-4 text-center">
                        <p className="text-2xl font-bold text-body">{data.totales.identificadoresUnicos}</p>
                        <p className="text-xs text-subtle">Identificadores distintos</p>
                    </div>
                    <div className="rounded-xl glass p-4 text-center">
                        <p className="text-2xl font-bold text-body">{data.porPais.length}</p>
                        <p className="text-xs text-subtle">Países</p>
                    </div>
                    <div className="rounded-xl glass p-4 text-center">
                        <p className="text-2xl font-bold text-body">{data.porCiudad.length}</p>
                        <p className="text-xs text-subtle">Ciudades</p>
                    </div>
                </div>
            </ChartCard>
        </section>
    );
}
