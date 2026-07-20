"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { ComiteSolicitudDetalle } from "./ComiteSolicitudDetalle";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

type Solicitud = {
    id: string;
    numero: string;
    reporteId: string;
    estado: "PENDIENTE" | "ASIGNADA" | "RESUELTA";
    motivo: string;
    creadoEn: string;
    comiteId?: string | null;
};

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

export function ComiteBandeja() {
    const { user } = useAuth();
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
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

    useEffect(() => {
        fetchSolicitudes();
    }, [fetchSolicitudes]);

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

    return (
        <div className="space-y-6">
            {error && (
                <ErrorState
                    title="No pudimos cargar las solicitudes"
                    description="Ocurrió un problema al consultar la bandeja del comité. Intenta de nuevo."
                    onRetry={fetchSolicitudes}
                />
            )}

            <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-subtle">
                            <tr>
                                <th className="px-4 py-3 font-medium">Número</th>
                                <th className="px-4 py-3 font-medium">Estado</th>
                                <th className="px-4 py-3 font-medium">Motivo</th>
                                <th className="px-4 py-3 font-medium">Recibida</th>
                                <th className="px-4 py-3 font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-subtle">
                                        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                                        <p className="mt-2 text-xs">Cargando...</p>
                                    </td>
                                </tr>
                            ) : solicitudes.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-2">
                                        <EmptyState
                                            title="No hay casos pendientes"
                                            description="Cuando lleguen solicitudes de revisión, aparecerán aquí."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                solicitudes.map((s) => {
                                    const readOnly = isReadOnly(s);
                                    return (
                                        <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                            <td className="px-4 py-3 font-mono text-xs text-body">{s.numero}</td>
                                            <td className="px-4 py-3">
                                                <span className={estadoBadge(s.estado)}>{s.estado}</span>
                                            </td>
                                            <td className="px-4 py-3 text-body max-w-xs truncate">{s.motivo}</td>
                                            <td className="px-4 py-3 text-subtle">{new Date(s.creadoEn).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {readOnly ? (
                                                        <span className="text-xs text-muted">
                                                            {s.estado === "RESUELTA" ? "Resuelto" : "Asignado a otro"}
                                                        </span>
                                                    ) : (
                                                        <Button
                                                            onClick={() => handleVer(s)}
                                                            disabled={assigningId === s.id}
                                                            variant="outline"
                                                            className="py-2 px-3 text-xs"
                                                        >
                                                            {assigningId === s.id ? "Asignando..." : "Ver"}
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
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
