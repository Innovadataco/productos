"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { ColegioNav } from "@/components/modules/colegio/ColegioNav";

type Alerta = {
    id: string;
    identificador: string;
    relacion: string;
    categoria: string | null;
    estadoReporte: string;
    estadoAlerta: string;
    creadoEn: string;
};

type FiltroEstado = "todas" | "nueva" | "vista" | "gestionada";

const ESTADO_LABELS: Record<string, string> = {
    nueva: "Nueva",
    vista: "Vista",
    gestionada: "Gestionada",
};

const ESTADO_VARIANTS: Record<string, "default" | "warning" | "success" | "neutral" | "info" | "danger"> = {
    nueva: "default",
    vista: "warning",
    gestionada: "success",
};

export default function AlertasColegioPage() {
    const [alertas, setAlertas] = useState<Alerta[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtro, setFiltro] = useState<FiltroEstado>("todas");
    const [accionando, setAccionando] = useState<Set<string>>(new Set());

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const url = new URL("/api/colegio/alertas", window.location.origin);
            if (filtro !== "todas") {
                url.searchParams.set("estado", filtro);
            }
            const res = await fetch(url.toString(), { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "Error cargando alertas");
                setAlertas([]);
                return;
            }
            setAlertas(data.alertas || []);
        } catch {
            setError("Error de red cargando alertas");
            setAlertas([]);
        } finally {
            setCargando(false);
        }
    }, [filtro]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const cambiarEstado = async (id: string, estado: "vista" | "gestionada") => {
        if (accionando.has(id)) return;
        setAccionando((prev) => new Set(prev).add(id));
        try {
            const res = await fetch(`/api/colegio/alertas/${id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "Error actualizando alerta");
                return;
            }
            setAlertas((prev) =>
                prev.map((a) => (a.id === id ? { ...a, estadoAlerta: data.alerta.estado } : a))
            );
        } catch {
            setError("Error de red actualizando alerta");
        } finally {
            setAccionando((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    return (
        <div className="min-h-screen bg-page">
            <ColegioNav />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-5xl space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-body">Alertas</h1>
                            <p className="text-sm text-muted">
                                Notificaciones anonimizadas sobre identificadores registrados.
                            </p>
                        </div>
                        <div className="w-full sm:w-48">
                            <Select
                                label="Filtrar por estado"
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value as FiltroEstado)}
                                options={[
                                    { value: "todas", label: "Todas" },
                                    { value: "nueva", label: "Nueva" },
                                    { value: "vista", label: "Vista" },
                                    { value: "gestionada", label: "Gestionada" },
                                ]}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                            {error}
                        </div>
                    )}

                    {cargando ? (
                        <div className="flex justify-center py-12">
                            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        </div>
                    ) : alertas.length === 0 ? (
                        <EmptyState
                            title="No hay alertas"
                            description="Cuando un reporte mencione un identificador registrado, aparecerá aquí."
                            icon={<span className="text-2xl">🛡️</span>}
                        />
                    ) : (
                        <div className="space-y-4">
                            {alertas.map((alerta) => (
                                <GlassCard key={alerta.id} className="border-l-4 border-l-emerald-500">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-medium text-body">
                                                    Identificador:
                                                </span>
                                                <span className="font-mono text-sm text-emerald-700 dark:text-emerald-300">
                                                    {alerta.identificador}
                                                </span>
                                                <Badge variant={ESTADO_VARIANTS[alerta.estadoAlerta] || "neutral"}>
                                                    {ESTADO_LABELS[alerta.estadoAlerta] || alerta.estadoAlerta}
                                                </Badge>
                                            </div>

                                            <div className="grid gap-2 text-sm sm:grid-cols-3">
                                                <div>
                                                    <span className="text-subtle">Relación:</span>{" "}
                                                    <span className="text-body capitalize">
                                                        {alerta.relacion.toLowerCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-subtle">Categoría:</span>{" "}
                                                    <span className="text-body">{alerta.categoria || "Sin clasificar"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-subtle">Estado del reporte:</span>{" "}
                                                    <span className="text-body">{alerta.estadoReporte}</span>
                                                </div>
                                            </div>

                                            <p className="text-xs text-muted">
                                                Recibida el{" "}
                                                {new Date(alerta.creadoEn).toLocaleString("es-CO", {
                                                    dateStyle: "medium",
                                                    timeStyle: "short",
                                                })}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                                            {alerta.estadoAlerta === "nueva" && (
                                                <Button
                                                    variant="secondary"
                                                    className="py-1.5 px-3 text-xs"
                                                    isLoading={accionando.has(alerta.id)}
                                                    onClick={() => cambiarEstado(alerta.id, "vista")}
                                                >
                                                    Marcar vista
                                                </Button>
                                            )}
                                            {alerta.estadoAlerta !== "gestionada" && (
                                                <Button
                                                    variant="outline"
                                                    className="py-1.5 px-3 text-xs"
                                                    isLoading={accionando.has(alerta.id)}
                                                    onClick={() => cambiarEstado(alerta.id, "gestionada")}
                                                >
                                                    Marcar gestionada
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
