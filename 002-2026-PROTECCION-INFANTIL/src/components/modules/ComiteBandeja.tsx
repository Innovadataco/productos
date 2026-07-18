"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { ComiteSolicitudDetalle } from "./ComiteSolicitudDetalle";

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

export function ComiteBandeja() {
    const [tab, setTab] = useState<"pendientes" | "mias">("pendientes");
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pagination, setPagination] = useState<Paginacion>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);

    const fetchSolicitudes = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const endpoint = tab === "pendientes" ? "/api/admin/comite/pendientes" : "/api/admin/comite/mias";
            const res = await fetch(`${endpoint}?page=${pagination.page}&limit=${pagination.limit}`, {
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
    }, [tab, pagination.page, pagination.limit]);

    useEffect(() => {
        fetchSolicitudes();
    }, [fetchSolicitudes]);

    const handleAsignar = async (solicitud: Solicitud) => {
        try {
            const res = await fetch(`/api/admin/comite/${solicitud.id}/asignar`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (!res.ok) throw new Error("Error asignando solicitud");
            await fetchSolicitudes();
        } catch {
            setError("Error asignando solicitud");
        }
    };

    const goToPage = (newPage: number) => {
        setPagination((p) => ({ ...p, page: newPage }));
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                    onClick={() => setTab("pendientes")}
                    className={`px-4 py-2 text-sm font-semibold ${
                        tab === "pendientes"
                            ? "text-accent border-b-2 border-accent"
                            : "text-muted hover:text-body"
                    }`}
                >
                    Pendientes
                </button>
                <button
                    onClick={() => setTab("mias")}
                    className={`px-4 py-2 text-sm font-semibold ${
                        tab === "mias"
                            ? "text-accent border-b-2 border-accent"
                            : "text-muted hover:text-body"
                    }`}
                >
                    Mías
                </button>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
                    {error}
                </div>
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
                                    <td colSpan={5} className="px-4 py-8 text-center text-subtle">
                                        No hay solicitudes {tab === "pendientes" ? "pendientes" : "asignadas"}.
                                    </td>
                                </tr>
                            ) : (
                                solicitudes.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                        <td className="px-4 py-3 font-mono text-xs text-body">{s.numero}</td>
                                        <td className="px-4 py-3">
                                            <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-body">
                                                {s.estado}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-body max-w-xs truncate">{s.motivo}</td>
                                        <td className="px-4 py-3 text-subtle">{new Date(s.creadoEn).toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                {tab === "pendientes" && s.estado === "PENDIENTE" && (
                                                    <Button onClick={() => handleAsignar(s)} variant="outline" className="py-2 px-3 text-xs">
                                                        Asignarme
                                                    </Button>
                                                )}
                                                <Button onClick={() => setSelectedSolicitud(s)} variant="outline" className="py-2 px-3 text-xs">
                                                    Ver
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
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
                />
            )}
        </div>
    );
}
