"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FileText, Layers } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { ComiteSolicitudDetalle } from "./ComiteSolicitudDetalle";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearEnBogota, type ColorSla } from "@/lib/comite/sla";

type Solicitud = {
    id: string;
    numero: string;
    reporteId: string;
    estado: "PENDIENTE" | "ASIGNADA" | "RESUELTA";
    motivo: string;
    creadoEn: string;
    comiteId?: string | null;
    // SPEC-139 (F5, ZEUS D-3): distintivo de reincidencia inter-ciudad (match).
    matchInterCiudad?: boolean;
    // SPEC-237: SLA de la tarea (servidor, zona Bogotá).
    sla?: SlaDto;
};

type SlaDto = {
    fechaLimite: string;
    color: ColorSla;
    vencido: boolean;
};

// SPEC-237 (002-PI-mega-cola): fila de consolidación de expediente (FR-001).
type ItemConsolidacion = {
    id: string;
    expedienteId: string;
    tipo: "CONSOLIDACION_EXPEDIENTE";
    estadoAprobacion: string;
    identificadorPrincipal: string;
    estadoExpediente: string;
    categoriaDominante: string | null;
    sla: SlaDto;
    aprobacionesActuales: number;
    aprobacionesRequeridas: number;
    createdAt: string;
};

type TipoFiltro = "TODOS" | "REVISION_REPORTE" | "CONSOLIDACION_EXPEDIENTE";

type FilaBandeja =
    | { tipo: "REVISION_REPORTE"; clave: string; creadoEn: string; solicitud: Solicitud }
    | { tipo: "CONSOLIDACION_EXPEDIENTE"; clave: string; creadoEn: string; consolidacion: ItemConsolidacion };

type Paginacion = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

function estadoBadge(estado: Solicitud["estado"]) {
    const base = "rounded-full px-2.5 py-0.5 text-xs font-medium";
    switch (estado) {
        case "PENDIENTE":
            return `${base} bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300`;
        case "ASIGNADA":
            return `${base} bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300`;
        case "RESUELTA":
            return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300`;
        default:
            return `${base} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300`;
    }
}

// SPEC-237 (FR-003): badge distintivo por tipo de tarea (tokens, sin color crudo).
function TipoBadge({ tipo }: { tipo: TipoFiltro }) {
    const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";
    if (tipo === "CONSOLIDACION_EXPEDIENTE") {
        return (
            <span className={`${base} bg-ambar/10 text-ambar`} data-testid="badge-consolidacion">
                <Layers className="h-3 w-3" aria-hidden />
                Consolidación
            </span>
        );
    }
    return (
        <span className={`${base} bg-cielo/10 text-cielo`} data-testid="badge-revision">
            <FileText className="h-3 w-3" aria-hidden />
            Revisión
        </span>
    );
}

// SPEC-237 (002-PI-mega-cola): indicador de SLA con semáforo pino/ambar/rubi en Bogotá.
function IndicadorSla({ sla }: { sla?: SlaDto | undefined }) {
    if (!sla) return <span className="text-xs text-muted">—</span>;
    const dotColor =
        sla.color === "rubi" ? "bg-rubi" : sla.color === "ambar" ? "bg-ambar" : "bg-pino";
    return (
        <span className="inline-flex items-center gap-1.5" data-testid={`sla-${sla.color}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} aria-hidden />
            <span className="text-xs text-subtle">
                {formatearEnBogota(new Date(sla.fechaLimite))}
                {sla.vencido ? " · vencido" : ""}
            </span>
        </span>
    );
}

export function ComiteBandeja() {
    const { user } = useAuth();
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [consolidaciones, setConsolidaciones] = useState<ItemConsolidacion[]>([]);
    const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("TODOS");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pagination, setPagination] = useState<Paginacion>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);
    const [assigningId, setAssigningId] = useState<string | null>(null);

    const fetchSolicitudes = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/comite/solicitudes?page=${pagination.page}&limit=${pagination.limit}`, {
                credentials: "include",
            });
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) throw new Error("Error cargando solicitudes");
            const json = await res.json();
            setSolicitudes(json.solicitudes || []);
            setPagination(json.paginacion || json.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch {
            setError("Error cargando solicitudes");
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit]);

    // SPEC-237: bandeja unificada — las consolidaciones llegan de su endpoint.
    const fetchConsolidaciones = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/comite/consolidacion?page=1&pageSize=50", {
                credentials: "include",
            });
            if (!res.ok) return; // la tabla de solicitudes sigue funcionando
            const json = await res.json();
            setConsolidaciones(json.items || []);
        } catch {
            // Fail-open: las revisiones de reporte no se bloquean por esto.
        }
    }, []);

    useEffect(() => {
        fetchSolicitudes();
    }, [fetchSolicitudes]);

    useEffect(() => {
        fetchConsolidaciones();
    }, [fetchConsolidaciones]);

    const handleVer = async (solicitud: Solicitud) => {
        if (solicitud.estado === "PENDIENTE") {
            setAssigningId(solicitud.id);
            try {
                const res = await fetch(`/api/admin/comite/${solicitud.id}/asignar`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                });
                const json = await res.json();
                if (!res.ok) {
                    if (res.status === 409 || res.status === 403) {
                        throw new Error(json.error?.message || "El caso ya fue asignado a otro miembro del comité");
                    }
                    throw new Error(json.error?.message || "Error asignando solicitud");
                }
                await fetchSolicitudes();
                setSelectedSolicitud({ ...solicitud, estado: "ASIGNADA", comiteId: user?.id || null });
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Error asignando solicitud");
            } finally {
                setAssigningId(null);
            }
        } else {
            setSelectedSolicitud(solicitud);
        }
    };

    const isReadOnly = (solicitud: Solicitud) => {
        if (solicitud.estado === "RESUELTA") return true;
        if (solicitud.estado === "ASIGNADA" && solicitud.comiteId && solicitud.comiteId !== user?.id) return true;
        return false;
    };

    const goToPage = (newPage: number) => {
        setPagination((p) => ({ ...p, page: newPage }));
    };

    // SPEC-237 (FR-002): filtro por tipo de tarea sobre la bandeja unificada.
    const filas: FilaBandeja[] = [
        ...(tipoFiltro !== "CONSOLIDACION_EXPEDIENTE"
            ? solicitudes.map<FilaBandeja>((s) => ({
                tipo: "REVISION_REPORTE",
                clave: `rev-${s.id}`,
                creadoEn: s.creadoEn,
                solicitud: s,
            }))
            : []),
        ...(tipoFiltro !== "REVISION_REPORTE"
            ? consolidaciones.map<FilaBandeja>((c) => ({
                tipo: "CONSOLIDACION_EXPEDIENTE",
                clave: `con-${c.id}`,
                creadoEn: c.createdAt,
                consolidacion: c,
            }))
            : []),
    ].sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());

    return (
        <div className="space-y-6">
            {error && (
                <ErrorState
                    title="No pudimos cargar las solicitudes"
                    description="Ocurrió un problema al consultar la bandeja del comité. Intenta de nuevo."
                    onRetry={fetchSolicitudes}
                />
            )}

            {/* SPEC-237 (FR-002): selector de tipo de tarea */}
            <div className="flex items-center gap-3">
                <label htmlFor="filtro-tipo-tarea" className="text-sm text-muted">
                    Tipo de tarea
                </label>
                <select
                    id="filtro-tipo-tarea"
                    value={tipoFiltro}
                    onChange={(e) => setTipoFiltro(e.target.value as TipoFiltro)}
                    className="rounded-lg border border-tinta/15 bg-transparent px-3 py-2 text-sm text-body"
                >
                    <option value="TODOS">Todas</option>
                    <option value="REVISION_REPORTE">Revisiones de reporte</option>
                    <option value="CONSOLIDACION_EXPEDIENTE">Consolidaciones</option>
                </select>
            </div>

            <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-subtle">
                            <tr>
                                <th className="px-4 py-3 font-medium">Tipo</th>
                                <th className="px-4 py-3 font-medium">Número</th>
                                <th className="px-4 py-3 font-medium">Estado</th>
                                <th className="px-4 py-3 font-medium">Motivo</th>
                                <th className="px-4 py-3 font-medium">SLA (Bogotá)</th>
                                <th className="px-4 py-3 font-medium">Recibida</th>
                                <th className="px-4 py-3 font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-subtle">
                                        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                                        <p className="mt-2 text-xs">Cargando...</p>
                                    </td>
                                </tr>
                            ) : filas.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-2">
                                        <EmptyState
                                            title="No hay casos pendientes"
                                            description="Cuando lleguen solicitudes de revisión o consolidaciones, aparecerán aquí."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                filas.map((fila) =>
                                    fila.tipo === "CONSOLIDACION_EXPEDIENTE" ? (
                                        <FilaConsolidacion key={fila.clave} item={fila.consolidacion} />
                                    ) : (
                                        <FilaRevision
                                            key={fila.clave}
                                            solicitud={fila.solicitud}
                                            readOnly={isReadOnly(fila.solicitud)}
                                            assigning={assigningId === fila.solicitud.id}
                                            onVer={handleVer}
                                        />
                                    )
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination.totalPages > 1 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-3">
                        <p className="text-sm text-subtle">
                            Página {pagination.page} de {pagination.totalPages} · {pagination.total} solicitudes
                        </p>
                        <div className="flex gap-2">
                            <Button onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page <= 1} variant="outline">
                                Anterior
                            </Button>
                            <Button onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} variant="outline">
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {selectedSolicitud && (
                <ComiteSolicitudDetalle
                    solicitud={selectedSolicitud}
                    onClose={() => setSelectedSolicitud(null)}
                    onRefresh={fetchSolicitudes}
                    readOnly={isReadOnly(selectedSolicitud)}
                />
            )}
        </div>
    );
}

function FilaRevision({
    solicitud: s,
    readOnly,
    assigning,
    onVer,
}: {
    solicitud: Solicitud;
    readOnly: boolean;
    assigning: boolean;
    onVer: (s: Solicitud) => void;
}) {
    return (
        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
            <td className="px-4 py-3">
                <TipoBadge tipo="REVISION_REPORTE" />
            </td>
            <td className="px-4 py-3 font-mono text-xs text-body">{s.numero}</td>
            <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className={estadoBadge(s.estado)}>{s.estado}</span>
                    {s.matchInterCiudad && (
                        <span
                            className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                            title="El identificador tiene reportes de fuentes independientes desde 2 o más ciudades"
                        >
                            Reincidencia inter-ciudad
                        </span>
                    )}
                </div>
            </td>
            <td className="px-4 py-3 text-body max-w-xs truncate">{s.motivo}</td>
            <td className="px-4 py-3">
                <IndicadorSla sla={s.sla} />
            </td>
            <td className="px-4 py-3 text-subtle">{new Date(s.creadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    {readOnly ? (
                        <span className="text-xs text-muted">
                            {s.estado === "RESUELTA" ? "Resuelto" : "Asignado a otro"}
                        </span>
                    ) : (
                        <Button
                            onClick={() => onVer(s)}
                            disabled={assigning}
                            variant="outline"
                            className="py-2 px-3 text-xs"
                        >
                            {assigning ? "Asignando..." : "Ver"}
                        </Button>
                    )}
                </div>
            </td>
        </tr>
    );
}

// SPEC-237 (FR-001/T016): la fila de consolidación linkea a la vista de detalle.
function FilaConsolidacion({ item }: { item: ItemConsolidacion }) {
    return (
        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
            <td className="px-4 py-3">
                <TipoBadge tipo="CONSOLIDACION_EXPEDIENTE" />
            </td>
            <td className="px-4 py-3 font-mono text-xs text-body">{item.identificadorPrincipal}</td>
            <td className="px-4 py-3">
                <span className="rounded-full bg-ambar/10 px-2.5 py-0.5 text-xs font-medium text-ambar">
                    {item.estadoAprobacion}
                </span>
            </td>
            <td className="px-4 py-3 text-body max-w-xs truncate">
                {item.categoriaDominante ?? "Expediente consolidado"} · Aprobaciones {item.aprobacionesActuales}/
                {item.aprobacionesRequeridas}
            </td>
            <td className="px-4 py-3">
                <IndicadorSla sla={item.sla} />
            </td>
            <td className="px-4 py-3 text-subtle">{new Date(item.createdAt).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td>
            <td className="px-4 py-3">
                <Link
                    href={`/dashboard/admin/comite/consolidacion/${item.expedienteId}`}
                    className="glass-input text-body hover:bg-papel/80 border inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200"
                >
                    Revisar
                </Link>
            </td>
        </tr>
    );
}
