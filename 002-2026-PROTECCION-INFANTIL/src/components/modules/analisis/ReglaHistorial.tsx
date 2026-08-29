"use client";

/**
 * SPEC-224 (002-PI-125, FR-011): vista de historial de versiones de una regla
 * — SOLO LECTURA (sin restauración automática en v1: restaurar = editar la
 * regla copiando valores, lo que genera una versión nueva). Versiones de más
 * reciente a más antigua con versión, fecha, admin, motivo y campos cambiados.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { formatoFechaHoraBogota } from "@/lib/fechas/formato-bogota";

interface ItemHistorialPanel {
    version: number;
    creadoEn: string;
    cambiadoPor: { id: string; nombre: string };
    motivo: string;
    camposCambiados: string[];
    snapshot: Record<string, unknown>;
}

interface ReglaHistorialProps {
    reglaId: string;
    claveRegla: string;
    onVolver: () => void;
}

export function ReglaHistorial({ reglaId, claveRegla, onVolver }: ReglaHistorialProps) {
    const [items, setItems] = useState<ItemHistorialPanel[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const respuesta = await fetch(`/api/admin/analisis/reglas/${reglaId}/historial`);
            const cuerpo = (await respuesta.json()) as {
                items?: ItemHistorialPanel[];
                error?: { message?: string };
            };
            if (!respuesta.ok) {
                setError(cuerpo.error?.message ?? "No se pudo cargar el historial");
                return;
            }
            setItems(cuerpo.items ?? []);
        } catch {
            setError("Error de red al cargar el historial");
        } finally {
            setCargando(false);
        }
    }, [reglaId]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    return (
        <div className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-body">Historial de versiones · {claveRegla}</h3>
                <Button variant="ghost" onClick={onVolver}>
                    Volver a la tabla
                </Button>
            </div>
            {cargando && <Cargando />}
            {error && <Alerta tono="error">{error}</Alerta>}
            {!cargando && !error && items.length === 0 && (
                <p className="text-sm text-muted">
                    Sin versiones anteriores: la regla no tiene ediciones todavía. Cada cambio guardado
                    genera una versión nueva con su snapshot y motivo.
                </p>
            )}
            {!cargando && !error && items.length > 0 && (
                <ul className="space-y-3">
                    {items.map((item) => (
                        <li key={item.version} className="rounded-xl border border-white/20 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="info">v{item.version}</Badge>
                                <span className="text-sm text-muted">
                                    {formatoFechaHoraBogota(item.creadoEn)} · {item.cambiadoPor.nombre}
                                </span>
                            </div>
                            <p className="mt-2 text-sm text-body">{item.motivo}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {item.camposCambiados.length === 0 ? (
                                    <span className="text-xs text-muted">Sin cambios en campos funcionales</span>
                                ) : (
                                    item.camposCambiados.map((campo) => (
                                        <Badge key={campo} variant="neutral">
                                            {campo}
                                        </Badge>
                                    ))
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
