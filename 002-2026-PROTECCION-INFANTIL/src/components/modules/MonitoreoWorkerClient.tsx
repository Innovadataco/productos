"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";

interface HealthWorkerResponse {
    status: "ok" | "degraded" | "error";
    workerAlive: boolean;
    dbOk: boolean;
    timestamp: string;
    message?: string;
}

export function MonitoreoWorkerClient() {
    const [estado, setEstado] = useState<HealthWorkerResponse | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");

    const consultar = useCallback(async () => {
        setCargando(true);
        setError("");
        try {
            const res = await fetch("/api/health/worker", { credentials: "include" });
            const json = (await res.json()) as HealthWorkerResponse;
            setEstado(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo consultar el estado");
            setEstado(null);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        consultar();
        const intervalo = setInterval(consultar, 30_000);
        return () => clearInterval(intervalo);
    }, [consultar]);

    if (cargando && !estado) {
        return <Cargando tamano="sm" texto="Consultando estado del worker..." className="py-10" />;
    }

    const ok = estado?.status === "ok";
    const degradado = estado?.status === "degraded";

    return (
        <div className="space-y-4">
            {error && (
                <GlassCard className="p-4">
                    <p className="text-sm text-rubi" role="alert">{error}</p>
                </GlassCard>
            )}

            <GlassCard className="p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-body">Estado general</h2>
                    <Badge variant={ok ? "success" : degradado ? "warning" : "danger"}>
                        {estado?.status ?? "desconocido"}
                    </Badge>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-tinta/10 p-4">
                        <p className="text-xs text-muted">Worker</p>
                        <p className="mt-1 text-sm font-medium text-body">
                            {estado?.workerAlive ? "Vivo" : "Sin señal"}
                        </p>
                    </div>
                    <div className="rounded-xl border border-tinta/10 p-4">
                        <p className="text-xs text-muted">Base de datos</p>
                        <p className="mt-1 text-sm font-medium text-body">
                            {estado?.dbOk ? "Conectada" : "Desconectada"}
                        </p>
                    </div>
                </div>

                {estado?.timestamp && (
                    <p className="mt-4 text-xs text-muted">
                        Última actualización: {new Date(estado.timestamp).toLocaleString("es-CO", { timeZone: "America/Bogota" })}
                    </p>
                )}
            </GlassCard>

            <div className="flex flex-wrap gap-2">
                <Button onClick={consultar} variant="outline" disabled={cargando}>
                    {cargando ? "Actualizando..." : "Actualizar"}
                </Button>
            </div>

            <p className="text-xs text-muted">
                Panel de solo lectura. No hay acciones de reinicio, detención ni purga disponibles.
            </p>
        </div>
    );
}
