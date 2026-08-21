"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";

type ColegioItem = {
    id: string;
    nombre: string;
    ciudad: string;
    departamento: string | null;
    fechaRegistro: string;
    estado: "activo" | "inactivo";
    alumnos: number;
    profesores: number;
    reportesUltimos30Dias: number;
    reportesTotal: number;
    alertasEscaladas: number;
    casosProcesadosPct: number;
    semaforo: "verde" | "amarillo" | "rojo";
};

type Paginacion = { page: number; pageSize: number; total: number; totalPages: number };

const PAGE_SIZE = 25;
const ORDENES = [
    { key: "nombre", label: "Nombre" },
    { key: "reportesTotal", label: "Reportes totales" },
    { key: "reportesUltimos30Dias", label: "Reportes 30 días" },
    { key: "alertasEscaladas", label: "Escalados" },
    { key: "casosProcesadosPct", label: "% procesados" },
    { key: "creadoEn", label: "Registro" },
] as const;

function fechaCorta(iso: string): string {
    return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function semaforoBadge(semaforo: ColegioItem["semaforo"]) {
    const variant = semaforo === "verde" ? "success" : semaforo === "rojo" ? "danger" : "warning";
    return <Badge variant={variant}>{semaforo}</Badge>;
}

export function ColegiosAnalyticsTable() {
    const [items, setItems] = useState<ColegioItem[]>([]);
    const [paginacion, setPaginacion] = useState<Paginacion>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [q, setQ] = useState("");
    const [orden, setOrden] = useState<string>("nombre");
    const [direccion, setDireccion] = useState<"asc" | "desc">("asc");
    const [page, setPage] = useState(1);
    const [activos, setActivos] = useState<{ q: string; orden: string; direccion: "asc" | "desc" }>({ q: "", orden: "nombre", direccion: "asc" });

    const cargar = useCallback(async (pagina: number, f: typeof activos) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pagina),
                pageSize: String(PAGE_SIZE),
                orden: f.orden,
                direccion: f.direccion,
            });
            if (f.q) params.set("q", f.q);

            const res = await fetch(`/api/admin/analytics/colegios?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setItems(data.items || []);
                setPaginacion(data.pagination || { page: pagina, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
                setMessage(null);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cargando colegios" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cargando colegios" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargar(page, activos);
    }, [cargar, page, activos]);

    function aplicarBusqueda(e: React.FormEvent) {
        e.preventDefault();
        setPage(1);
        setActivos({ q: q.trim(), orden, direccion });
    }

    function cambiarOrden(nuevoOrden: string) {
        const nuevaDireccion = activos.orden === nuevoOrden && activos.direccion === "asc" ? "desc" : "asc";
        setOrden(nuevoOrden);
        setDireccion(nuevaDireccion);
        setPage(1);
        setActivos({ q: activos.q, orden: nuevoOrden, direccion: nuevaDireccion });
    }

    return (
        <div className="space-y-6">
            {message && (
                <Alerta tono={message.type === "error" ? "error" : "exito"} className="p-4">
                    {message.text}
                </Alerta>
            )}

            <GlassCard>
                <form onSubmit={aplicarBusqueda} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <Input
                            label="Buscar colegio"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Nombre del colegio"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit">Buscar</Button>
                        {activos.q && (
                            <Button type="button" variant="outline" onClick={() => { setQ(""); setPage(1); setActivos({ q: "", orden, direccion }); }}>
                                Limpiar
                            </Button>
                        )}
                    </div>
                </form>
            </GlassCard>

            <GlassCard>
                {loading ? (
                    <Cargando inline texto="Cargando colegios..." className="py-8" />
                ) : items.length === 0 ? (
                    <EmptyState title="Sin colegios" description="No hay colegios que coincidan con la búsqueda." />
                ) : (
                    <>
                        <Tabla sinContenedor>
                            <TablaHead variante="borde">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Semáforo</th>
                                    <th className="pb-3 font-medium cursor-pointer" onClick={() => cambiarOrden("nombre")}>Nombre {activos.orden === "nombre" && (activos.direccion === "asc" ? "↑" : "↓")}</th>
                                    <th className="pb-3 font-medium">Ciudad</th>
                                    <th className="pb-3 font-medium">Estado</th>
                                    <th className="pb-3 font-medium cursor-pointer" onClick={() => cambiarOrden("creadoEn")}>Registro {activos.orden === "creadoEn" && (activos.direccion === "asc" ? "↑" : "↓")}</th>
                                    <th className="pb-3 font-medium">Alumnos</th>
                                    <th className="pb-3 font-medium">Profesores</th>
                                    <th className="pb-3 font-medium cursor-pointer" onClick={() => cambiarOrden("reportesUltimos30Dias")}>30 días {activos.orden === "reportesUltimos30Dias" && (activos.direccion === "asc" ? "↑" : "↓")}</th>
                                    <th className="pb-3 font-medium cursor-pointer" onClick={() => cambiarOrden("reportesTotal")}>Total {activos.orden === "reportesTotal" && (activos.direccion === "asc" ? "↑" : "↓")}</th>
                                    <th className="pb-3 font-medium cursor-pointer" onClick={() => cambiarOrden("alertasEscaladas")}>Escalados {activos.orden === "alertasEscaladas" && (activos.direccion === "asc" ? "↑" : "↓")}</th>
                                    <th className="pb-3 font-medium cursor-pointer" onClick={() => cambiarOrden("casosProcesadosPct")}>% Proc. {activos.orden === "casosProcesadosPct" && (activos.direccion === "asc" ? "↑" : "↓")}</th>
                                    <th className="pb-3 font-medium text-right">Acciones</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {items.map((c) => (
                                    <tr key={c.id} className="align-top">
                                        <td className="py-3 pr-3">{semaforoBadge(c.semaforo)}</td>
                                        <td className="py-3 pr-3 text-body font-medium">{c.nombre}</td>
                                        <td className="py-3 pr-3 text-muted">{c.ciudad}{c.departamento ? `, ${c.departamento}` : ""}</td>
                                        <td className="py-3 pr-3"><Badge variant={c.estado === "activo" ? "success" : "neutral"}>{c.estado}</Badge></td>
                                        <td className="py-3 pr-3 text-muted">{fechaCorta(c.fechaRegistro)}</td>
                                        <td className="py-3 pr-3 text-muted">{c.alumnos}</td>
                                        <td className="py-3 pr-3 text-muted">{c.profesores}</td>
                                        <td className="py-3 pr-3 text-muted">{c.reportesUltimos30Dias}</td>
                                        <td className="py-3 pr-3 text-muted">{c.reportesTotal}</td>
                                        <td className="py-3 pr-3 text-muted">{c.alertasEscaladas}</td>
                                        <td className="py-3 pr-3 text-muted">{Math.round(c.casosProcesadosPct * 100)}%</td>
                                        <td className="py-3 text-right">
                                            <Link
                                                href={`/dashboard/admin/estadisticas/operacion/colegios/${c.id}`}
                                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-body hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                            >
                                                Ver ficha
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </TablaBody>
                        </Tabla>
                        <div className="mt-4 flex items-center justify-between text-sm text-muted">
                            <span>
                                Página {paginacion.page} de {Math.max(paginacion.totalPages, 1)} · {paginacion.total} colegios
                            </span>
                            <div className="flex gap-2">
                                <Button variant="outline" className="px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                                    Anterior
                                </Button>
                                <Button variant="outline" className="px-3 py-1.5 text-xs" disabled={page >= paginacion.totalPages} onClick={() => setPage((p) => p + 1)}>
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </GlassCard>
        </div>
    );
}
