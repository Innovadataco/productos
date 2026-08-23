"use client";

import { useCallback, useEffect, useState } from "react";
import { Cargando } from "@/components/ui/Cargando";
import { ErrorState } from "@/components/ui/ErrorState";

interface SesionDto {
    id: string;
    usuarioId: string;
    email: string;
    nombre: string | null;
    rol: string;
    iniciadaEn: string;
    ultimaActividadEn: string;
    duracionMin: number;
    ipHash: string;
    ipHashCorto: string;
    userAgent: string | null;
}

interface ListadoResponse {
    items: SesionDto[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export function SesionesTab() {
    const [data, setData] = useState<ListadoResponse | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cerrandoId, setCerrandoId] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/sesiones", { credentials: "include" });
            const json: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const mensaje =
                    json && typeof json === "object" && "error" in json
                        ? (json as { error?: { message?: string } }).error?.message
                        : undefined;
                setError(mensaje || "No se pudo cargar las sesiones activas.");
                return;
            }
            setData(json as ListadoResponse);
        } catch {
            setError("Error de red al cargar las sesiones activas.");
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    async function cerrarSesion(id: string) {
        if (!confirm("¿Forzar el cierre de esta sesión? El usuario deberá volver a iniciar sesión.")) return;
        setCerrandoId(id);
        try {
            const res = await fetch(`/api/admin/sesiones/${id}/cerrar`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) {
                const json: unknown = await res.json().catch(() => null);
                const mensaje =
                    json && typeof json === "object" && "error" in json
                        ? (json as { error?: { message?: string } }).error?.message
                        : undefined;
                alert(mensaje || "No se pudo cerrar la sesión.");
                return;
            }
            void cargar();
        } finally {
            setCerrandoId(null);
        }
    }

    if (cargando && !data) return <Cargando texto="Cargando sesiones activas..." />;
    if (error && !data) return <ErrorState title="Error" description={error} onRetry={() => void cargar()} />;

    const items = data?.items ?? [];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Sesiones activas</h2>
                <button
                    type="button"
                    onClick={() => void cargar()}
                    className="rounded-lg bg-tinta/10 px-3 py-1.5 text-sm font-medium text-body hover:bg-tinta/20"
                >
                    Refrescar
                </button>
            </div>

            {items.length === 0 ? (
                <p className="text-sm text-muted">No hay sesiones activas en este momento.</p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-tinta/10">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-tinta/5 text-muted">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Usuario</th>
                                <th className="px-4 py-3 font-semibold">Rol</th>
                                <th className="px-4 py-3 font-semibold">Iniciada</th>
                                <th className="px-4 py-3 font-semibold">Última actividad</th>
                                <th className="px-4 py-3 font-semibold">Duración</th>
                                <th className="px-4 py-3 font-semibold">IP</th>
                                <th className="px-4 py-3 font-semibold">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-tinta/10">
                            {items.map((s) => (
                                <tr key={s.id} className="hover:bg-tinta/5">
                                    <td className="px-4 py-3 text-body">
                                        <div>{s.nombre || "—"}</div>
                                        <div className="text-xs text-muted">{s.email}</div>
                                    </td>
                                    <td className="px-4 py-3 text-body">{s.rol}</td>
                                    <td className="px-4 py-3 text-muted">{formatearFecha(s.iniciadaEn)}</td>
                                    <td className="px-4 py-3 text-muted">{formatearFecha(s.ultimaActividadEn)}</td>
                                    <td className="px-4 py-3 text-muted">{s.duracionMin} min</td>
                                    <td className="px-4 py-3 font-mono text-xs text-muted" title={s.ipHash}>
                                        …{s.ipHashCorto}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => void cerrarSesion(s.id)}
                                            disabled={cerrandoId === s.id}
                                            className="rounded-lg bg-rubi px-3 py-1.5 text-xs font-medium text-white hover:bg-rubi/90 disabled:opacity-50"
                                        >
                                            {cerrandoId === s.id ? "Cerrando..." : "Forzar cierre"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function formatearFecha(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}
