"use client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { ESTADOS, formatCategoria, formatEstado } from "../utils";
import type { CasoItem, Paginacion } from "../types";

type HistorialCasosProps = {
    estadoFiltro: string;
    setEstadoFiltro: (value: string) => void;
    page: number;
    setPage: (value: number | ((prev: number) => number)) => void;
    casos: CasoItem[];
    pagination: Paginacion;
    loading: boolean;
    error: string;
    onRetry: () => void;
    onVerDetalle: (id: string) => void;
};

export function HistorialCasos({
    estadoFiltro,
    setEstadoFiltro,
    page,
    setPage,
    casos,
    pagination,
    loading,
    error,
    onRetry,
    onVerDetalle,
}: HistorialCasosProps) {
    return (
        <section className="space-y-4" aria-labelledby="historial-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 id="historial-title" className="text-lg font-semibold text-body">
                    Historial de casos
                </h2>
                <Select
                    label="Estado"
                    options={ESTADOS}
                    value={estadoFiltro}
                    onChange={(e) => {
                        setEstadoFiltro(e.target.value);
                        setPage(1);
                    }}
                    className="sm:w-64"
                />
            </div>
            <GlassCard>
                {error ? (
                    <ErrorState title="No pudimos cargar el historial" description={error} onRetry={onRetry} />
                ) : loading ? (
                    <Cargando inline texto="Cargando casos..." className="py-8" />
                ) : casos.length === 0 ? (
                    <EmptyState
                        title="Sin casos en este estado"
                        description="El operador no tiene casos que coincidan con el filtro seleccionado."
                    />
                ) : (
                    <>
                        <Tabla sinContenedor>
                            <TablaHead variante="borde">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">RPT</th>
                                    <th className="pb-3 font-medium">Identificador</th>
                                    <th className="pb-3 font-medium">Plataforma</th>
                                    <th className="pb-3 font-medium">Categoría</th>
                                    <th className="pb-3 font-medium">Estado</th>
                                    <th className="pb-3 font-medium">Asignado</th>
                                    <th className="pb-3 font-medium text-right">Acciones</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {casos.map((c) => (
                                    <tr key={c.id} className="align-top">
                                        <td className="py-3 pr-3 font-mono text-xs text-body">
                                            {c.numeroSeguimiento || "—"}
                                        </td>
                                        <td className="py-3 pr-3 text-body">{c.identificador}</td>
                                        <td className="py-3 pr-3 text-muted">{c.plataformaNombre}</td>
                                        <td className="py-3 pr-3 text-muted">{formatCategoria(c.categoria)}</td>
                                        <td className="py-3 pr-3">
                                            <Badge variant={c.estado === "REVISION_MANUAL" ? "warning" : "neutral"}>
                                                {formatEstado(c.estado)}
                                            </Badge>
                                        </td>
                                        <td className="py-3 pr-3 text-muted">
                                            {new Date(c.asignadoEn).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}
                                        </td>
                                        <td className="py-3 text-right">
                                            <Button
                                                variant="outline"
                                                className="px-3 py-1.5 text-xs"
                                                onClick={() => onVerDetalle(c.id)}
                                            >
                                                Ver detalle
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </TablaBody>
                        </Tabla>
                        {pagination.totalPages > 1 && (
                            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-subtle">
                                    Página {pagination.page} de {pagination.totalPages} · {pagination.total} casos
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="px-3 py-1.5 text-xs"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="px-3 py-1.5 text-xs"
                                        disabled={page >= pagination.totalPages}
                                        onClick={() => setPage((p: number) => p + 1)}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </GlassCard>
        </section>
    );
}
