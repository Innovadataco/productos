"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { Alerta } from "@/components/ui/Alerta";
import { GlassCard } from "@/components/ui/GlassCard";
import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SaludMotor } from "./types";

export function SaludMotorBloque() {
    const [salud, setSalud] = useState<SaludMotor | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/notificaciones/salud", { credentials: "include" });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error?.message || "Error cargando salud del motor");
            setSalud(body);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    function formatPercent(value: number | null): string {
        if (value === null || value === undefined) return "—";
        return `${(value * 100).toFixed(1)}%`;
    }

    function formatNumber(value: number | null): string {
        if (value === null || value === undefined) return "—";
        return value.toLocaleString("es-CO");
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-body">Métricas operativas</h2>
                <Button variant="outline" onClick={() => void cargar()} disabled={loading}>
                    Refrescar
                </Button>
            </div>

            {error && <Alerta tono="error">{error}</Alerta>}

            {loading && !salud ? (
                <Cargando texto="Cargando métricas..." />
            ) : !salud ? (
                <EmptyState title="Sin datos" description="No se pudieron cargar las métricas del motor." />
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <TarjetaMetrica
                            label="Cola lista para enviar"
                            value={formatNumber(salud.colaActual)}
                            disposicion="panel"
                            tone={salud.colaActual > 100 ? "up" : undefined}
                        />
                        <TarjetaMetrica
                            label="Programaciones atrasadas"
                            value={formatNumber(salud.atrasadas)}
                            disposicion="panel"
                            tone={salud.atrasadas > 0 ? "up" : undefined}
                        />
                        <TarjetaMetrica
                            label="Tasa de entrega (7 días)"
                            value={formatPercent(salud.tasaEntrega7d)}
                            disposicion="panel"
                            tone={salud.tasaEntrega7d !== null && salud.tasaEntrega7d < 0.9 ? "up" : undefined}
                        />
                        <TarjetaMetrica
                            label="Tasa de apertura (7 días)"
                            value={formatPercent(salud.tasaApertura7d)}
                            disposicion="panel"
                        />
                        <TarjetaMetrica
                            label="Errores 24 horas"
                            value={formatNumber(salud.errores24h)}
                            disposicion="panel"
                            tone={salud.errores24h > 0 ? "up" : undefined}
                        />
                        <TarjetaMetrica
                            label="Latencia promedio"
                            value={salud.latenciaPromedioMs !== null ? formatNumber(salud.latenciaPromedioMs) : "—"}
                            suffix={salud.latenciaPromedioMs !== null ? " ms" : undefined}
                            disposicion="panel"
                        />
                    </div>

                    <GlassCard>
                        <h3 className="text-base font-semibold text-body">Envíos últimos 7 días</h3>
                        <p className="mt-2 text-3xl font-bold text-body">{formatNumber(salud.enviadas7d)}</p>
                        <p className="text-xs text-muted">Total de notificaciones enviadas en la última semana.</p>
                    </GlassCard>
                </>
            )}
        </div>
    );
}
