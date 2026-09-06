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
    nota: string | null;
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

function labelEscenario(escenario: Escenario): string {
    return ESCENARIO_OPCIONES.find((o) => o.value === escenario)?.label ?? escenario;
}

function truncarNota(nota: string | null, max = 40): string | null {
    if (!nota) return null;
    return nota.length > max ? `${nota.slice(0, max)}…` : nota;
}

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
    const [copiadoId, setCopiadoId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ mensaje: string; id: string } | null>(null);

    const mostrarToast = useCallback((mensaje: string) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setToast({ mensaje, id });
        setTimeout(() => {
            setToast((actual) => (actual?.id === id ? null : actual));
        }, 2500);
    }, []);

    const copiarId = useCallback(async (id: string) => {
        try {
            await navigator.clipboard.writeText(id);
            setCopiadoId(id);
            mostrarToast("ID copiado al portapapeles");
            setTimeout(() => setCopiadoId((actual) => (actual === id ? null : actual)), 2000);
        } catch {
            mostrarToast("No se pudo copiar el ID");
        }
    }, [mostrarToast]);

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
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Escenario</th>
                            <th className="px-4 py-3">Nota</th>
                            <th className="px-4 py-3">Estado</th>
                            <th className="px-4 py-3">Progreso</th>
                            <th className="px-4 py-3">Creada</th>
                            <th className="px-4 py-3 text-right">Acción</th>
                        </tr>
                    </TablaHead>
                    <TablaBody>
                        {runs.map((r) => (
                            <tr key={r.id} className="hover:bg-tinta/5 transition">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <code className="font-mono text-xs">{r.id.slice(0, 8)}</code>
                                        <button
                                            type="button"
                                            onClick={() => void copiarId(r.id)}
                                            className="text-xs text-accent hover:underline"
                                            aria-label={`Copiar ID ${r.id.slice(0, 8)}`}
                                        >
                                            {copiadoId === r.id ? "Copiado" : "Copiar"}
                                        </button>
                                    </div>
                                </td>
                                <td className="px-4 py-3 font-medium">{labelEscenario(r.escenario)}</td>
                                <td className="px-4 py-3 text-muted" title={r.nota ?? undefined}>
                                    {truncarNota(r.nota) ?? "—"}
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant={ESTADO_VARIANT[r.estado]}>{ESTADO_LABELS[r.estado]}</Badge>
                                </td>
                                <td className="px-4 py-3">
                                    {r.progreso}/{r.totalReportes}
                                </td>
                                <td className="px-4 py-3 text-muted">
                                    {new Date(r.creadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" })}
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

            {toast ? (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-body px-4 py-3 text-sm font-medium text-white shadow-lg transition-opacity duration-200"
                >
                    <svg aria-hidden="true" className="h-4 w-4 text-pino" viewBox="0 0 20 20" fill="currentColor">
                        <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                        />
                    </svg>
                    {toast.mensaje}
                </div>
            ) : null}
        </div>
    );
}
