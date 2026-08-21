"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { UsuariosSubNav } from "@/components/modules/admin/UsuariosSubNav";

type UsuarioItem = {
    id: string;
    email: string;
    nombre: string | null;
    estado: "activo" | "inactivo" | "bloqueado";
    creadoEn: string;
    ultimaSesion: string | null;
    reportesEnviados: number;
    colegiosAsociados: { id: string; nombre: string }[];
};

type Paginacion = { page: number; pageSize: number; total: number; totalPages: number };

const PAGE_SIZE = 25;

function fechaCorta(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export default function UsuariosAdminClient() {
    const searchParams = useSearchParams();
    const rol = (searchParams.get("rol") as UsuarioItem["estado"] | null) ?? "PARENT";

    const [items, setItems] = useState<UsuarioItem[]>([]);
    const [paginacion, setPaginacion] = useState<Paginacion>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [q, setQ] = useState("");
    const [estado, setEstado] = useState("");
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");
    const [conReportes, setConReportes] = useState("");
    const [page, setPage] = useState(1);

    const [filtrosActivos, setFiltrosActivos] = useState({
        q: "",
        estado: "",
        desde: "",
        hasta: "",
        conReportes: "",
    });

    const cargar = useCallback(async (pagina: number, f: typeof filtrosActivos) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pagina),
                pageSize: String(PAGE_SIZE),
                rol: rol || "PARENT",
            });
            if (f.q) params.set("q", f.q);
            if (f.estado) params.set("estado", f.estado);
            if (f.desde) params.set("desde", f.desde);
            if (f.hasta) params.set("hasta", f.hasta);
            if (f.conReportes) params.set("conReportes", f.conReportes);

            const res = await fetch(`/api/admin/usuarios?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setItems(data.items || []);
                setPaginacion(data.pagination || { page: pagina, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
                setMessage(null);
            } else {
                setMessage({ type: "error", text: data?.error?.message || "Error cargando usuarios" });
            }
        } catch {
            setMessage({ type: "error", text: "Error de red cargando usuarios" });
        } finally {
            setLoading(false);
        }
    }, [rol]);

    useEffect(() => {
        setPage(1);
        setFiltrosActivos({ q: "", estado: "", desde: "", hasta: "", conReportes: "" });
        setQ("");
        setEstado("");
        setDesde("");
        setHasta("");
        setConReportes("");
    }, [rol]);

    useEffect(() => {
        cargar(page, filtrosActivos);
    }, [cargar, page, filtrosActivos]);

    function aplicarFiltros(e: React.FormEvent) {
        e.preventDefault();
        setPage(1);
        setFiltrosActivos({ q: q.trim(), estado, desde, hasta, conReportes });
    }

    function limpiarFiltros() {
        setQ("");
        setEstado("");
        setDesde("");
        setHasta("");
        setConReportes("");
        setPage(1);
        setFiltrosActivos({ q: "", estado: "", desde: "", hasta: "", conReportes: "" });
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Usuarios</h1>
                <p className="text-sm text-muted">
                    Vista unificada de cuentas por rol. Solo lectura; para acciones de cuenta usa la gestión específica de cada rol.
                </p>
            </div>

            <UsuariosSubNav />

            {message && (
                <Alerta tono={message.type === "error" ? "error" : "exito"} className="p-4">
                    {message.text}
                </Alerta>
            )}

            <GlassCard>
                <form onSubmit={aplicarFiltros} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Input
                        label="Buscar"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Email o nombre"
                    />
                    <div>
                        <label className="mb-1 block text-sm font-medium text-body">Estado</label>
                        <select
                            value={estado}
                            onChange={(e) => setEstado(e.target.value)}
                            className="w-full rounded-xl border border-tinta/20 bg-papel/70 px-3 py-2 text-sm text-body outline-none focus:border-pino dark:bg-papel/70"
                        >
                            <option value="">Todos</option>
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                            <option value="bloqueado">Bloqueado</option>
                        </select>
                    </div>
                    <Input label="Desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                    <Input label="Hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                    <div>
                        <label className="mb-1 block text-sm font-medium text-body">Reportes</label>
                        <select
                            value={conReportes}
                            onChange={(e) => setConReportes(e.target.value)}
                            className="w-full rounded-xl border border-tinta/20 bg-papel/70 px-3 py-2 text-sm text-body outline-none focus:border-pino dark:bg-papel/70"
                        >
                            <option value="">Todos</option>
                            <option value="true">Con reportes</option>
                            <option value="false">Sin reportes</option>
                        </select>
                    </div>
                    <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
                        <Button type="submit">Filtrar</Button>
                        {(filtrosActivos.q || filtrosActivos.estado || filtrosActivos.desde || filtrosActivos.hasta || filtrosActivos.conReportes) && (
                            <Button type="button" variant="outline" onClick={limpiarFiltros}>
                                Limpiar
                            </Button>
                        )}
                    </div>
                </form>
            </GlassCard>

            <GlassCard>
                {loading ? (
                    <Cargando inline texto="Cargando usuarios..." className="py-8" />
                ) : items.length === 0 ? (
                    <EmptyState
                        title="Sin resultados"
                        description="No hay usuarios que coincidan con los filtros seleccionados."
                    />
                ) : (
                    <>
                        <Tabla sinContenedor>
                            <TablaHead variante="borde">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Email</th>
                                    <th className="pb-3 font-medium">Nombre</th>
                                    <th className="pb-3 font-medium">Estado</th>
                                    <th className="pb-3 font-medium">Registro</th>
                                    <th className="pb-3 font-medium">Última sesión</th>
                                    <th className="pb-3 font-medium">Reportes</th>
                                    <th className="pb-3 font-medium">Colegio</th>
                                    <th className="pb-3 font-medium text-right">Acciones</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {items.map((u) => (
                                    <tr key={u.id} className="align-top">
                                        <td className="py-3 pr-3 text-body">{u.email}</td>
                                        <td className="py-3 pr-3 text-muted">{u.nombre || "—"}</td>
                                        <td className="py-3 pr-3">
                                            <Badge variant={u.estado === "activo" ? "success" : "neutral"}>{u.estado}</Badge>
                                        </td>
                                        <td className="py-3 pr-3 text-muted">{fechaCorta(u.creadoEn)}</td>
                                        <td className="py-3 pr-3 text-muted">{fechaCorta(u.ultimaSesion)}</td>
                                        <td className="py-3 pr-3 text-muted">{u.reportesEnviados}</td>
                                        <td className="py-3 pr-3 text-muted">
                                            {u.colegiosAsociados.map((c) => c.nombre).join(", ") || "—"}
                                        </td>
                                        <td className="py-3 text-right">
                                            <Link
                                                href={`/dashboard/admin/usuarios/${u.id}`}
                                                className="rounded-lg border border-tinta/20 bg-papel/70 px-3 py-1.5 text-xs text-body hover:bg-tinta/5 dark:border-tinta/30 dark:bg-papel/70 dark:hover:bg-tinta/10"
                                            >
                                                Ver detalle
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </TablaBody>
                        </Tabla>
                        <div className="mt-4 flex items-center justify-between text-sm text-muted">
                            <span>
                                Página {paginacion.page} de {Math.max(paginacion.totalPages, 1)} · {paginacion.total} usuarios
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
