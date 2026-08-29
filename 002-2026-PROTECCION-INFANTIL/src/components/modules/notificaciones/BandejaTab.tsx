"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { Alerta } from "@/components/ui/Alerta";
import { Tabla, TablaHead, TablaBody } from "@/components/ui/Tabla";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatoFechaHoraBogota } from "@/lib/fechas/formato-bogota";
import type { NotificacionItem, EstadoEnvio } from "./types";
import { ESTADO_LABELS, CANAL_LABELS } from "./types";

type Catalogos = { estados: EstadoEnvio[]; canales: ("EMAIL" | "IN_APP")[] };

export function BandejaTab() {
    const [items, setItems] = useState<NotificacionItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [catalogos, setCatalogos] = useState<Catalogos>({ estados: [], canales: [] });
    const [filtros, setFiltros] = useState({
        evento: "",
        canal: "",
        estado: "",
        destinatarioEmail: "",
        fechaDesde: "",
        fechaHasta: "",
    });
    const [mensaje, setMensaje] = useState<string | null>(null);
    const [reenviando, setReenviando] = useState<string | null>(null);

    const buildQuery = useCallback(() => {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        if (filtros.evento) params.set("evento", filtros.evento);
        if (filtros.canal) params.set("canal", filtros.canal);
        if (filtros.estado) params.set("estado", filtros.estado);
        if (filtros.destinatarioEmail) params.set("destinatarioEmail", filtros.destinatarioEmail);
        if (filtros.fechaDesde) params.set("fechaDesde", filtros.fechaDesde);
        if (filtros.fechaHasta) params.set("fechaHasta", filtros.fechaHasta);
        return params.toString();
    }, [filtros, page, pageSize]);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/notificaciones/bandeja?${buildQuery()}`, { credentials: "include" });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error?.message || "Error cargando bandeja");
            setItems(body.items || []);
            setTotal(body.pagination?.total || 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setLoading(false);
        }
    }, [buildQuery]);

    useEffect(() => {
        fetch("/api/admin/notificaciones/catalogos", { credentials: "include" })
            .then((r) => r.json())
            .then(setCatalogos)
            .catch(() => setError("No se pudieron cargar los catálogos"));
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    async function reenviar(id: string) {
        setReenviando(id);
        setMensaje(null);
        try {
            const res = await fetch("/api/admin/notificaciones/bandeja", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error?.message || "Error al reenviar");
            setMensaje("Envío reencolado correctamente.");
            void cargar();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setReenviando(null);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="space-y-5">
            <GlassCard>
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-body">Bandeja de envíos</h2>
                    <p className="text-sm text-muted">Consulta el ciclo de vida de cada envío del motor.</p>
                </div>
                {mensaje && <Alerta tono="exito" className="mb-4">{mensaje}</Alerta>}
                {error && <Alerta tono="error" className="mb-4">{error}</Alerta>}
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <input
                        type="text"
                        placeholder="Evento"
                        value={filtros.evento}
                        onChange={(e) => { setFiltros((f) => ({ ...f, evento: e.target.value })); setPage(1); }}
                        className="rounded-xl border border-tinta/15 bg-papel/60 px-3 py-2 text-sm text-body placeholder:text-muted focus:border-ambar focus:outline-none"
                    />
                    <select
                        value={filtros.canal}
                        onChange={(e) => { setFiltros((f) => ({ ...f, canal: e.target.value })); setPage(1); }}
                        className="rounded-xl border border-tinta/15 bg-papel/60 px-3 py-2 text-sm text-body focus:border-ambar focus:outline-none"
                    >
                        <option value="">Todos los canales</option>
                        {catalogos.canales.map((c) => (
                            <option key={c} value={c}>
                                {CANAL_LABELS[c]}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filtros.estado}
                        onChange={(e) => { setFiltros((f) => ({ ...f, estado: e.target.value })); setPage(1); }}
                        className="rounded-xl border border-tinta/15 bg-papel/60 px-3 py-2 text-sm text-body focus:border-ambar focus:outline-none"
                    >
                        <option value="">Todos los estados</option>
                        {catalogos.estados.map((e) => (
                            <option key={e} value={e}>
                                {ESTADO_LABELS[e]}
                            </option>
                        ))}
                    </select>
                    <input
                        type="text"
                        placeholder="Destinatario"
                        value={filtros.destinatarioEmail}
                        onChange={(e) => { setFiltros((f) => ({ ...f, destinatarioEmail: e.target.value })); setPage(1); }}
                        className="rounded-xl border border-tinta/15 bg-papel/60 px-3 py-2 text-sm text-body placeholder:text-muted focus:border-ambar focus:outline-none"
                    />
                </div>
                <div className="mb-4 flex flex-wrap gap-3">
                    <input
                        type="date"
                        value={filtros.fechaDesde}
                        onChange={(e) => { setFiltros((f) => ({ ...f, fechaDesde: e.target.value })); setPage(1); }}
                        className="rounded-xl border border-tinta/15 bg-papel/60 px-3 py-2 text-sm text-body focus:border-ambar focus:outline-none"
                    />
                    <input
                        type="date"
                        value={filtros.fechaHasta}
                        onChange={(e) => { setFiltros((f) => ({ ...f, fechaHasta: e.target.value })); setPage(1); }}
                        className="rounded-xl border border-tinta/15 bg-papel/60 px-3 py-2 text-sm text-body focus:border-ambar focus:outline-none"
                    />
                    <Button variant="outline" onClick={() => setPage(1)}>
                        Filtrar
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setFiltros({ evento: "", canal: "", estado: "", destinatarioEmail: "", fechaDesde: "", fechaHasta: "" });
                            setPage(1);
                        }}
                    >
                        Limpiar
                    </Button>
                </div>
                {loading && items.length === 0 ? (
                    <Cargando texto="Cargando envíos..." />
                ) : items.length === 0 ? (
                    <p className="text-sm text-muted">No hay envíos que coincidan con los filtros.</p>
                ) : (
                    <Tabla aria-label="Bandeja de envíos" sinContenedor>
                        <TablaHead variante="borde">
                            <tr>
                                <th className="pb-3 font-medium">Evento</th>
                                <th className="pb-3 font-medium">Canal</th>
                                <th className="pb-3 font-medium">Destinatario</th>
                                <th className="pb-3 font-medium">Estado</th>
                                <th className="pb-3 font-medium">Programada</th>
                                <th className="pb-3 font-medium">Enviada</th>
                                <th className="pb-3 font-medium">Acciones</th>
                            </tr>
                        </TablaHead>
                        <TablaBody>
                            {items.map((n) => (
                                <tr key={n.id}>
                                    <td className="py-3 pr-4 text-body">{n.evento}</td>
                                    <td className="py-3 pr-4 text-muted">{CANAL_LABELS[n.canal]}</td>
                                    <td className="py-3 pr-4 text-muted">{n.destinatarioEmail}</td>
                                    <td className="py-3 pr-4 text-body">{ESTADO_LABELS[n.estado]}</td>
                                    <td className="py-3 pr-4 text-muted">
                                        {n.enviarEn ? formatoFechaHoraBogota(n.enviarEn) : "—"}
                                    </td>
                                    <td className="py-3 pr-4 text-muted">
                                        {n.sentAt ? formatoFechaHoraBogota(n.sentAt) : "—"}
                                    </td>
                                    <td className="py-3">
                                        <Button
                                            variant="outline"
                                            className="px-3 py-1 text-xs"
                                            isLoading={reenviando === n.id}
                                            disabled={!["ENVIADA", "ABIERTA", "CLICADA", "FALLIDA", "CANCELADA"].includes(n.estado)}
                                            onClick={() => void reenviar(n.id)}
                                        >
                                            Reenviar
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </TablaBody>
                    </Tabla>
                )}
                <div className="mt-4 flex items-center justify-between text-sm text-muted">
                    <span>
                        Página {page} de {totalPages} · {total} resultados
                    </span>
                    <div className="flex gap-2">
                        <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            Anterior
                        </Button>
                        <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                            Siguiente
                        </Button>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
