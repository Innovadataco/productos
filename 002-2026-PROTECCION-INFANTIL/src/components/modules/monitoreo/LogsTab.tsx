"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Alerta } from "@/components/ui/Alerta";
import type { WorkerLog } from "@prisma/client";
import { LogsFilters, type LogsFiltersState } from "./LogsFilters";
import { LogsTable } from "./LogsTable";
import { LogContextoModal } from "./LogContextoModal";

const LIMIT = 100;
const INTERVALO_MS = 30_000;

function localDateTimeToIso(valor: string): string | undefined {
    if (!valor) return undefined;
    const d = new Date(`${valor}:00`);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
}

type DatosLogs = {
    items: WorkerLog[];
    total: number;
};

export function LogsTab() {
    const [filters, setFilters] = useState<LogsFiltersState>({
        servicio: "",
        nivel: "",
        desde: "",
        hasta: "",
        q: "",
    });
    const [offset, setOffset] = useState(0);
    const [autorefresco, setAutorefresco] = useState(false);
    const [datos, setDatos] = useState<DatosLogs>({ items: [], total: 0 });
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [contextoSeleccionado, setContextoSeleccionado] = useState<WorkerLog | null>(null);

    const buildQuery = useCallback(() => {
        const params = new URLSearchParams();
        params.set("limit", String(LIMIT));
        params.set("offset", String(offset));
        if (filters.servicio) params.set("servicio", filters.servicio);
        if (filters.nivel) params.set("nivel", filters.nivel);
        const desdeIso = localDateTimeToIso(filters.desde);
        const hastaIso = localDateTimeToIso(filters.hasta);
        if (desdeIso) params.set("desde", desdeIso);
        if (hastaIso) params.set("hasta", hastaIso);
        if (filters.q) params.set("q", filters.q);
        return params.toString();
    }, [filters, offset]);

    const fetchLogs = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/monitoreo/logs?${buildQuery()}`, {
                credentials: "include",
            });
            const data: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const mensaje =
                    data && typeof data === "object" && "error" in data
                        ? (data as { error?: { message?: string } }).error?.message
                        : undefined;
                setError(mensaje || "No se pudieron consultar los logs.");
                return;
            }
            const parsed = data as DatosLogs;
            setDatos({
                items: Array.isArray(parsed.items) ? parsed.items : [],
                total: typeof parsed.total === "number" ? parsed.total : 0,
            });
        } catch {
            setError("Error de red al consultar los logs.");
        } finally {
            setCargando(false);
        }
    }, [buildQuery]);

    useEffect(() => {
        void fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        if (!autorefresco) return;
        const id = setInterval(() => {
            void fetchLogs();
        }, INTERVALO_MS);
        return () => clearInterval(id);
    }, [autorefresco, fetchLogs]);

    const aplicarFiltros = (nuevos: LogsFiltersState) => {
        setOffset(0);
        setFilters(nuevos);
    };

    const hayAnterior = offset > 0;
    const haySiguiente = offset + LIMIT < datos.total;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-body">Logs de workers</h2>
                    <p className="text-sm text-muted">
                        Eventos técnicos de los servicios. No incluyen textos de reportes.
                    </p>
                </div>
                <Button
                    variant={autorefresco ? "secondary" : "outline"}
                    onClick={() => setAutorefresco((v) => !v)}
                    aria-pressed={autorefresco}
                    className="self-start sm:self-auto"
                >
                    {autorefresco ? "Autorefresco activo (30 s)" : "Autorefresco apagado"}
                </Button>
            </div>

            <LogsFilters filters={filters} onChange={aplicarFiltros} />

            {error && (
                <ErrorState
                    title="No pudimos cargar los logs"
                    description={error}
                    onRetry={() => void fetchLogs()}
                />
            )}

            {cargando && datos.items.length === 0 ? (
                <Cargando inline texto="Cargando logs..." className="py-8" />
            ) : datos.items.length === 0 && !error ? (
                <EmptyState
                    title="Sin logs para los filtros seleccionados"
                    description="Ajusta el rango o los criterios de búsqueda."
                />
            ) : (
                <>
                    <LogsTable items={datos.items} onVerContexto={setContextoSeleccionado} />
                    <div className="flex flex-col gap-3 border-t border-tinta/10 px-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-subtle">
                            {datos.total > 0
                                ? `Mostrando ${offset + 1} - ${Math.min(offset + LIMIT, datos.total)} de ${datos.total}`
                                : "0 resultados"}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="px-3 py-1.5 text-xs"
                                disabled={!hayAnterior || cargando}
                                onClick={() => setOffset((v) => Math.max(0, v - LIMIT))}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                className="px-3 py-1.5 text-xs"
                                disabled={!haySiguiente || cargando}
                                onClick={() => setOffset((v) => v + LIMIT)}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                    {cargando && datos.items.length > 0 && (
                        <Alerta tono="info" role="status" className="mt-2">
                            Actualizando...
                        </Alerta>
                    )}
                </>
            )}

            <LogContextoModal
                isOpen={!!contextoSeleccionado}
                onClose={() => setContextoSeleccionado(null)}
                contextoJson={contextoSeleccionado?.contextoJson ?? null}
            />
        </div>
    );
}
