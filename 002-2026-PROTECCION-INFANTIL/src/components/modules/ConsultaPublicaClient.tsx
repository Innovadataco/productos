"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { BarChart } from "./BarChart";
import { DonutChart } from "./DonutChart";
import { MetricCard } from "./MetricCard";
import { ChartCard } from "./ChartCard";
import { MiniList } from "./MiniList";

const MapaUbicaciones = dynamic(
    () => import("./MapaUbicaciones").then((mod) => mod.MapaUbicaciones),
    { ssr: false }
);

function formatFecha(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

function formatMes(mes: string) {
    const d = new Date(`${mes}-01T00:00:00Z`);
    return d.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
}

type Ubicacion = {
    pais: string;
    ciudad: string;
    total: number;
    fechasReporte: string[];
    fechasIncidente: string[];
    lat?: number | null;
    lng?: number | null;
};

type ConsultaResponse = {
    identificador: string;
    tieneReportes: boolean;
    visibleEnDashboard?: boolean;
    mensaje?: string;
    totalReportes?: number;
    reportesAutenticados?: number;
    reportesAnonimos?: number;
    primerReporte?: string | null;
    ultimoReporte?: string | null;
    plataformas?: { id: string; nombre: string; clave: string; total: number }[];
    ubicaciones?: Ubicacion[];
    timeline?: { mes: string; total: number }[];
    resumen?: string;
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

    const plataformasChart = (data?.plataformas ?? []).map((p) => ({ label: p.nombre, value: p.total }));
    const timelineChart = (data?.timeline ?? []).map((t) => ({ label: formatMes(t.mes), value: t.total }));
    const ubicacionesList = (data?.ubicaciones ?? []).map((u) => ({
        label: `${u.ciudad}, ${u.pais}`,
        count: u.total,
    }));
    const puntosMapa = (data?.ubicaciones ?? [])
        .filter((u) => typeof u.lat === "number" && typeof u.lng === "number")
        .map((u) => ({
            lat: u.lat as number,
            lng: u.lng as number,
            label: `${u.ciudad}, ${u.pais}`,
            total: u.total,
        }));

    return (
        <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-body">Consulta pública</h1>
                <p className="mt-2 text-muted">
                    Ingresa un número, nick o usuario para conocer el historial agregado de reportes.
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
                <div className="mx-auto mt-6 max-w-xl rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
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
                        <MetricCard label="Total reportes" value={data.totalReportes ?? 0} />
                        <MetricCard label="Autenticados" value={data.reportesAutenticados ?? 0} />
                        <MetricCard label="Anónimos" value={data.reportesAnonimos ?? 0} />
                        <MetricCard label="Estado" value="Con reportes" />
                    </div>

                    {/* Resumen */}
                    <ChartCard title="Resumen" subtitle={`${data.identificador} — información agregada`}>
                        <p className="text-sm text-muted">{data.resumen || "No hay resumen disponible."}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <p>
                                <span className="text-subtle">Primer reporte:</span>{" "}
                                <span className="text-body">{formatFecha(data.primerReporte)}</span>
                            </p>
                            <p>
                                <span className="text-subtle">Último reporte:</span>{" "}
                                <span className="text-body">{formatFecha(data.ultimoReporte)}</span>
                            </p>
                        </div>
                    </ChartCard>

                    {/* Gráficos */}
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        {plataformasChart.length > 0 && (
                            <ChartCard title="Plataformas" subtitle="Distribución por plataforma">
                                <DonutChart data={plataformasChart} ariaLabel="Distribución por plataforma" />
                            </ChartCard>
                        )}
                        {timelineChart.length > 0 && (
                            <ChartCard title="Reportes por mes" subtitle="Evolución temporal agregada">
                                <BarChart data={timelineChart} ariaLabel="Reportes por mes" />
                            </ChartCard>
                        )}
                    </div>

                    {/* Ubicaciones: mapa + lista */}
                    <ChartCard
                        title="Ubicaciones reportadas"
                        subtitle="Ciudades con reportes. Sin direcciones exactas ni datos personales."
                    >
                        <div className="space-y-4">
                            {puntosMapa.length > 0 && <MapaUbicaciones puntos={puntosMapa} />}
                            {ubicacionesList.length > 0 ? (
                                <MiniList items={ubicacionesList} empty="Sin ubicaciones" />
                            ) : (
                                <p className="text-sm text-muted">Sin ubicaciones reportadas</p>
                            )}
                        </div>
                    </ChartCard>

                    {/* Detalle de ubicaciones */}
                    <div className="glass rounded-2xl overflow-hidden">
                        <div className="p-5">
                            <h3 className="text-base font-semibold text-body">Detalle de ubicaciones</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100/70 text-subtle dark:bg-slate-800/60">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">País</th>
                                        <th className="px-4 py-3 font-medium">Ciudad</th>
                                        <th className="px-4 py-3 font-medium">Reportes</th>
                                        <th className="px-4 py-3 font-medium">Fechas reporte</th>
                                        <th className="px-4 py-3 font-medium">Fechas incidente</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {(data.ubicaciones ?? []).map((u, idx) => (
                                        <tr
                                            key={idx}
                                            className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                                        >
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
                </div>
            )}
        </main>
    );
}
