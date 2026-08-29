"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { Alerta } from "@/components/ui/Alerta";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";
import { formatPlataformasResumen } from "@/lib/plataforma";
import { CATEGORIAS_LABELS } from "@/lib/labels";
import { ConsultaVaciaBloque, type ConsultaVaciaBloqueData } from "./ConsultaVaciaBloque";

const MapaUbicaciones = dynamic(
    () => import("./MapaUbicaciones").then((mod) => mod.MapaUbicaciones),
    { ssr: false }
);

function formatFecha(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium" });
}

type ReporteDetalle = {
    id: string;
    plataforma: string;
    esAnonimo: boolean;
    fecha: string;
    categoria: string;
    categoriaLabel: string;
    categoriaGrupo: string;
};

type UbicacionDetalle = {
    pais: string;
    ciudad: string;
    total: number;
    lat: number | null;
    lng: number | null;
};

type PlataformaDetalle = {
    id: string;
    nombre: string;
    clave: string;
    total: number;
    otraPlataforma?: string | null;
};

type DetalleResponse = {
    identificador: string;
    tieneReportes: boolean;
    mensaje?: string;
    // F3 (N-5): contenido curado del estado vacío (parámetros, sin IA).
    bloqueVacia?: ConsultaVaciaBloqueData;
    actividad?: "alta" | "baja";
    totalReportes?: number;
    reportesAutenticados?: number;
    reportesAnonimos?: number;
    ultimoReporte?: string | null;
    plataformas?: PlataformaDetalle[];
    resumenPlataformas?: string;
    categorias?: { categoria: string; total: number }[];
    reportes?: ReporteDetalle[];
    ubicaciones?: UbicacionDetalle[];
    timeline?: { mes: string; total: number }[];
    resumen?: string;
};

export function ConsultaEnriquecidaClient() {
    const [identificador, setIdentificador] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [data, setData] = useState<DetalleResponse | null>(null);

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
            const res = await fetch("/api/consulta/detalle", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identificador }),
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

    const puntosMapa = (data?.ubicaciones ?? [])
        .filter((u) => typeof u.lat === "number" && typeof u.lng === "number")
        .map((u) => ({
            lat: u.lat as number,
            lng: u.lng as number,
            label: `${u.ciudad}, ${u.pais}`,
            total: u.total,
        }));

    // SPEC-115: degradación honesta — contar los reportes que el mapa no puede pintar
    const sinUbicacion = (data?.ubicaciones ?? [])
        .filter((u) => typeof u.lat !== "number" || typeof u.lng !== "number")
        .reduce((sum, u) => sum + u.total, 0);

    return (
        <div className="space-y-5">
            <form onSubmit={handleSubmit}>
                <div className="glass rounded-2xl p-4 sm:p-5">
                    <Input
                        label="Número, nick o usuario"
                        placeholder="Ej: 3002222222 o @usuario"
                        value={identificador}
                        onChange={(e) => setIdentificador(e.target.value)}
                    />
                    <div className="mt-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Consultando..." : "Buscar"}
                        </Button>
                    </div>
                </div>
            </form>

            {error && (
                <Alerta tono="error" className="p-4">
                    {error}
                </Alerta>
            )}

            {data && !data.tieneReportes && (
                <div className="space-y-4">
                    <div className="rounded-xl glass p-6 text-center">
                        <p className="text-body">{data.mensaje || "Sin reportes registrados para este identificador."}</p>
                    </div>
                    {data.bloqueVacia && <ConsultaVaciaBloque bloque={data.bloqueVacia} identificador={data.identificador} />}
                </div>
            )}

            {data?.tieneReportes && (
                <div className="space-y-5 animate-floatUp">
                    <GlassCard className="text-center">
                        <p className="text-sm text-subtle">{data.identificador}</p>
                        <div className="mt-3 flex justify-center">
                            <Badge variant="info" className="text-sm px-3 py-1">
                                Actividad {data.actividad === "alta" ? "alta" : "baja"} de reportes
                            </Badge>
                        </div>
                        <p className="mt-4 text-base font-medium text-body">
                            {data.resumenPlataformas || formatPlataformasResumen(data.plataformas ?? [], data.totalReportes)}
                        </p>
                        {data.categorias && data.categorias.length > 0 && (
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                                {data.categorias.map((c) => (
                                    <Badge key={c.categoria} variant="neutral">
                                        {CATEGORIAS_LABELS[c.categoria] ?? c.categoria} · {c.total}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </GlassCard>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <TarjetaMetrica mono label="Total reportes" value={data.totalReportes ?? 0} />
                        <TarjetaMetrica mono label="Último reporte" value={formatFecha(data.ultimoReporte)} />
                        <TarjetaMetrica mono label="Reportes autenticados" value={data.reportesAutenticados ?? 0} />
                    </div>

                    <GlassCard>
                        <h3 className="text-base font-semibold text-body mb-4">Reportes clasificados</h3>
                        <Tabla sinContenedor>
                            <TablaHead>
                                <tr>
                                    <th className="px-4 py-3 font-medium">Plataforma</th>
                                    <th className="px-4 py-3 font-medium">Fecha</th>
                                    <th className="px-4 py-3 font-medium">Clasificación</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {(data.reportes ?? []).map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                        <td className="px-4 py-3 text-body">
                                            {r.plataforma}
                                            {r.esAnonimo && (
                                                <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-muted dark:bg-slate-800">
                                                        Anónimo
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-body">{formatFecha(r.fecha)}</td>
                                        <td className="px-4 py-3 text-body">{r.categoriaGrupo}</td>
                                    </tr>
                                ))}
                            </TablaBody>
                        </Tabla>
                    </GlassCard>

                    {data.timeline && data.timeline.length > 0 && (
                        <GlassCard>
                            <h3 className="text-base font-semibold text-body mb-3">Reportes por mes</h3>
                            <ul className="space-y-1 text-sm text-body">
                                {data.timeline.map((t) => (
                                    <li key={t.mes} className="flex items-center justify-between gap-2">
                                        <span>{t.mes}</span>
                                        <span className="text-xs text-subtle">{t.total} reportes</span>
                                    </li>
                                ))}
                            </ul>
                        </GlassCard>
                    )}

                    {data.resumen && (
                        <p className="text-sm text-muted text-center">{data.resumen}</p>
                    )}

                    {puntosMapa.length > 0 && (
                        <GlassCard>
                            <h3 className="text-base font-semibold text-body mb-4">Ubicaciones aproximadas</h3>
                            <p className="text-xs text-subtle mb-3">
                                Ciudades con reportes. Sin direcciones exactas ni datos personales.
                            </p>
                            {/* U1 (002-PI-051): el mapa arranca en vista general (zoom 3,
                                sin acercar); el usuario acerca manualmente. */}
                            <MapaUbicaciones puntos={puntosMapa} zoom={3} sinUbicacion={sinUbicacion} />
                        </GlassCard>
                    )}
                </div>
            )}
        </div>
    );
}
