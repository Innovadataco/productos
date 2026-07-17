"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { BarChart } from "./BarChart";
import { DonutChart } from "./DonutChart";

const MapaPuntos = dynamic(
    () => import("./MapaPuntos").then((mod) => ({ default: mod.MapaPuntos })),
    { ssr: false }
);

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

const RIESGO_COLORS: Record<string, string> = {
    BAJO: "bg-emerald-500",
    MEDIO: "bg-amber-500",
    ALTO: "bg-orange-500",
    CRITICO: "bg-red-500",
};

function formatCategoria(categoria: string) {
    return CATEGORIAS_LABELS[categoria] || categoria;
}

function formatFecha(iso: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

type Ubicacion = {
    pais: string;
    ciudad: string;
    lat: number | null;
    lng: number | null;
    total: number;
    fechasReporte: string[];
    fechasIncidente: string[];
};

type ConsultaResponse = {
    identificador: string;
    tieneReportes: boolean;
    visibleEnDashboard?: boolean;
    mensaje?: string;
    totalReportes: number;
    reportesAutenticados: number;
    reportesAnonimos: number;
    score?: number;
    nivelRiesgo?: string;
    ratioAutenticados?: number;
    primerReporte: string;
    ultimoReporte: string;
    plataformas: { id: string; nombre: string; clave: string; total: number }[];
    categorias: { categoria: string; total: number; confianzaPromedio: number | null }[];
    ubicaciones: Ubicacion[];
    timeline: { mes: string; total: number }[];
    resumen: string;
};

export function ConsultaPublicaClient() {
    const [identificador, setIdentificador] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [data, setData] = useState<ConsultaResponse | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identificador.trim() || identificador.length < 3) {
            setError("Ingresa un identificador válido (mínimo 3 caracteres).");
            return;
        }
        setLoading(true);
        setError("");
        setData(null);
        try {
            const res = await fetch(`/api/consulta?identificador=${encodeURIComponent(identificador)}`, {
                credentials: "include",
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(json?.error?.message || "Error consultando el identificador.");
                return;
            }
            setData(json);
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const puntosMapa = data?.ubicaciones
        .filter((u) => u.lat != null && u.lng != null)
        .map((u) => ({
            lat: u.lat as number,
            lng: u.lng as number,
            label: u.ciudad,
            sub: u.pais,
            count: u.total,
            extra: `${u.fechasReporte.length} fecha(s) de reporte`,
        })) || [];

    const plataformasChart = data?.plataformas.map((p) => ({ label: p.nombre, value: p.total })) || [];
    const categoriasChart = data?.categorias.map((c) => ({ label: formatCategoria(c.categoria), value: c.total })) || [];
    const timelineChart = data?.timeline.map((t) => ({ label: t.mes, value: t.total })) || [];

    return (
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-body">Consulta pública</h1>
                <p className="mt-2 text-muted">
                    Ingresa un número telefónico, nick o usuario para conocer el historial agregado de reportes.
                </p>
                <p className="text-xs text-subtle">
                    No se muestra el contenido de los reportes ni datos de las personas.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="mx-auto max-w-xl">
                <div className="glass rounded-2xl p-4 sm:p-5">
                    <Input
                        label="Número, nick o usuario"
                        placeholder="Ej: 3002222222 o @usuario"
                        value={identificador}
                        onChange={(e) => setIdentificador(e.target.value)}
                    />
                    <div className="mt-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Consultando..." : "Consultar"}
                        </Button>
                    </div>
                </div>
            </form>

            {error && (
                <div className="mx-auto mt-6 max-w-xl rounded-xl bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            {data && !data.tieneReportes && (
                <div className="mx-auto mt-6 max-w-xl rounded-xl glass p-6 text-center">
                    <p className="text-body">{data.mensaje}</p>
                </div>
            )}

            {data?.tieneReportes && (
                <div className="mt-8 space-y-5">
                    {/* Métricas principales */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <MetricCard label="Total reportes" value={data.totalReportes} />
                        <MetricCard label="Autenticados" value={data.reportesAutenticados} />
                        <MetricCard label="Anónimos" value={data.reportesAnonimos} />
                        {data.score != null ? (
                            <MetricCard label="Score" value={data.score} suffix="/100" sub={data.nivelRiesgo} />
                        ) : (
                            <MetricCard label="Ratio autenticados" value={Math.round((data.ratioAutenticados || 0) * 100)} suffix="%" />
                        )}
                    </div>

                    {/* Resumen */}
                    <div className="glass rounded-2xl p-5">
                        <h2 className="text-lg font-semibold text-body">Resumen</h2>
                        <p className="mt-1 text-sm text-muted">{data.resumen}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <p><span className="text-subtle">Primer reporte:</span> <span className="text-body">{formatFecha(data.primerReporte)}</span></p>
                            <p><span className="text-subtle">Último reporte:</span> <span className="text-body">{formatFecha(data.ultimoReporte)}</span></p>
                        </div>
                    </div>

                    {/* Mapa */}
                    <MapaPuntos
                        puntos={puntosMapa}
                        title="Mapa de reportes por ciudad"
                        subtitle="Cantidad de reportes por ciudad. Sin direcciones exactas ni datos personales."
                    />

                    {/* Gráficos */}
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        {plataformasChart.length > 0 && (
                            <div className="glass rounded-2xl p-5">
                                <h3 className="mb-3 text-base font-semibold text-body">Plataformas</h3>
                                <DonutChart data={plataformasChart} />
                            </div>
                        )}
                        {categoriasChart.length > 0 && (
                            <div className="glass rounded-2xl p-5">
                                <h3 className="mb-3 text-base font-semibold text-body">Categorías</h3>
                                <DonutChart data={categoriasChart} />
                            </div>
                        )}
                    </div>

                    {timelineChart.length > 0 && (
                        <div className="glass rounded-2xl p-5">
                            <h3 className="mb-3 text-base font-semibold text-body">Reportes por mes</h3>
                            <BarChart data={timelineChart} />
                        </div>
                    )}

                    {/* Tabla de ubicaciones */}
                    <div className="glass rounded-2xl overflow-hidden">
                        <div className="p-5">
                            <h3 className="text-base font-semibold text-body">Ubicaciones reportadas</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-subtle">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">País</th>
                                        <th className="px-4 py-3 font-medium">Ciudad</th>
                                        <th className="px-4 py-3 font-medium">Reportes</th>
                                        <th className="px-4 py-3 font-medium">Fechas reporte</th>
                                        <th className="px-4 py-3 font-medium">Fechas incidente</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {data.ubicaciones.map((u, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                            <td className="px-4 py-3 text-body">{u.pais}</td>
                                            <td className="px-4 py-3 text-body">{u.ciudad}</td>
                                            <td className="px-4 py-3 text-body">{u.total}</td>
                                            <td className="px-4 py-3 text-subtle">{u.fechasReporte.slice(0, 5).join(", ")}</td>
                                            <td className="px-4 py-3 text-subtle">{u.fechasIncidente.slice(0, 5).join(", ")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Categorías detalle */}
                    <div className="glass rounded-2xl overflow-hidden">
                        <div className="p-5">
                            <h3 className="text-base font-semibold text-body">Categorías detectadas</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-subtle">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Categoría</th>
                                        <th className="px-4 py-3 font-medium">Reportes</th>
                                        <th className="px-4 py-3 font-medium">Confianza promedio</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {data.categorias.map((c, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                            <td className="px-4 py-3 text-body">{formatCategoria(c.categoria)}</td>
                                            <td className="px-4 py-3 text-body">{c.total}</td>
                                            <td className="px-4 py-3 text-subtle">
                                                {c.confianzaPromedio != null ? `${(c.confianzaPromedio * 100).toFixed(1)}%` : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

function MetricCard({ label, value, suffix = "", sub }: { label: string; value: string | number; suffix?: string; sub?: string }) {
    return (
        <div className="glass rounded-2xl p-5 text-center transition hover:scale-[1.02]">
            <p className="text-3xl font-bold text-body">
                {value}
                {suffix && <span className="text-lg">{suffix}</span>}
            </p>
            {sub && <p className={`text-xs font-semibold ${RIESGO_COLORS[sub] ? "text-body" : "text-accent"}`}>{sub}</p>}
            <p className="mt-1 text-xs text-subtle">{label}</p>
        </div>
    );
}
