"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaHead, TablaBody } from "@/components/ui/Tabla";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

type Escenario = "robot_inundando" | "ataque_coordinado" | "bot_ips_rotativas" | "denunciante_spam" | "personalizado";
type EstadoRun = "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA" | "FALLIDA" | "CANCELADA";

type RunListItem = {
    id: string;
    escenario: Escenario;
    n: number;
    totalReportes: number;
    progreso: number;
    estado: EstadoRun;
    totalEnviados: number;
    totalBloqueados: number;
    totalSpam: number;
    latenciaP50Ms: number;
    creadoEn: string;
    actualizadoEn: string;
};

const ESCENARIO_OPCIONES = [
    { value: "robot_inundando", label: "1. Robot inundando" },
    { value: "ataque_coordinado", label: "2. Ataque coordinado" },
    { value: "bot_ips_rotativas", label: "3. Bot IPs rotativas" },
    { value: "denunciante_spam", label: "4. Denunciante spam" },
    { value: "personalizado", label: "5. Personalizado" },
];

const ESTADO_LABELS: Record<EstadoRun, string> = {
    PENDIENTE: "Pendiente",
    EN_PROGRESO: "En progreso",
    COMPLETADA: "Completada",
    FALLIDA: "Fallida",
    CANCELADA: "Cancelada",
};

const ESTADO_VARIANT: Record<EstadoRun, "default" | "success" | "warning" | "danger" | "info" | "neutral"> = {
    PENDIENTE: "info",
    EN_PROGRESO: "warning",
    COMPLETADA: "success",
    FALLIDA: "danger",
    CANCELADA: "neutral",
};

interface HistorialProps {
    onVerDetalle: (id: string) => void;
}

export function AdminAntiAbusoSimuladorHistorial({ onVerDetalle }: HistorialProps) {
    const [runs, setRuns] = useState<RunListItem[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage] = useState(1);
    const [filtroEstado, setFiltroEstado] = useState("");
    const [filtroEscenario, setFiltroEscenario] = useState("");
    const [cargando, setCargando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("pageSize", "25");
            if (filtroEstado) params.set("estado", filtroEstado);
            if (filtroEscenario) params.set("escenario", filtroEscenario);
            const res = await fetch(`/api/admin/anti-abuso/simular?${params.toString()}`, { credentials: "include" });
            if (!res.ok) return;
            const json = await res.json();
            setRuns(json.items as RunListItem[]);
            setTotalPages(json.pagination.totalPages as number);
        } catch {
            // ignore
        } finally {
            setCargando(false);
        }
    }, [page, filtroEstado, filtroEscenario]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
                <Select
                    label="Estado"
                    options={[
                        { value: "", label: "Todos" },
                        { value: "PENDIENTE", label: "Pendiente" },
                        { value: "EN_PROGRESO", label: "En progreso" },
                        { value: "COMPLETADA", label: "Completada" },
                        { value: "FALLIDA", label: "Fallida" },
                        { value: "CANCELADA", label: "Cancelada" },
                    ]}
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                />
                <Select
                    label="Escenario"
                    options={[{ value: "", label: "Todos" }, ...ESCENARIO_OPCIONES]}
                    value={filtroEscenario}
                    onChange={(e) => setFiltroEscenario(e.target.value)}
                />
            </div>

            {cargando ? (
                <Cargando texto="Cargando historial..." />
            ) : runs.length === 0 ? (
                <EmptyState title="Sin corridas" description="Aún no hay simulaciones registradas." />
            ) : (
                <Tabla aria-label="Historial de simulaciones de abuso">
                    <TablaHead>
                        <tr>
                            <th className="px-4 py-3">Escenario</th>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3">Progreso</th>
                            <th className="px-4 py-3">Creada</th>
                            <th className="px-4 py-3 text-right">Acción</th>
                        </tr>
                    </TablaHead>
                    <TablaBody>
                        {runs.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-4 py-3 font-medium">{r.escenario}</td>
                                <td className="px-4 py-3">
                                    <Badge variant={ESTADO_VARIANT[r.estado]}>{ESTADO_LABELS[r.estado]}</Badge>
                                </td>
                                <td className="px-4 py-3">
                                    {r.progreso}/{r.totalReportes}
                                </td>
                                <td className="px-4 py-3 text-muted">
                                    {new Date(r.creadoEn).toLocaleString("es-CO")}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Button variant="ghost" className="h-auto px-2 py-1 text-xs" onClick={() => onVerDetalle(r.id)}>
                                        Ver detalle
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </TablaBody>
                </Tabla>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                        Anterior
                    </Button>
                    <span className="text-sm text-muted">
                        Página {page} de {totalPages}
                    </span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                        Siguiente
                    </Button>
                </div>
            )}
        </div>
    );
}
