"use client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { formatCategoria, formatDuracion, formatEstado } from "../utils";
import type { CasoAbierto } from "../types";

type CasosAbiertosTableProps = {
    casos: CasoAbierto[];
    onVerDetalle: (id: string) => void;
    onReasignar: (c: CasoAbierto) => void;
};

export function CasosAbiertosTable({ casos, onVerDetalle, onReasignar }: CasosAbiertosTableProps) {
    return (
        <section className="space-y-4" aria-labelledby="abiertos-title">
            <h2 id="abiertos-title" className="text-lg font-semibold text-body">
                Casos abiertos
            </h2>
            <GlassCard>
                {casos.length === 0 ? (
                    <EmptyState
                        title="Sin casos abiertos"
                        description="El operador no tiene casos en revisión manual actualmente."
                    />
                ) : (
                    <Tabla sinContenedor>
                        <TablaHead variante="borde">
                            <tr className="text-subtle">
                                <th className="pb-3 font-medium">RPT</th>
                                <th className="pb-3 font-medium">Categoría</th>
                                <th className="pb-3 font-medium">Estado</th>
                                <th className="pb-3 font-medium">Tiempo desde asignación</th>
                                <th className="pb-3 font-medium text-right">Acciones</th>
                            </tr>
                        </TablaHead>
                        <TablaBody>
                            {casos.map((c) => (
                                <tr key={c.id} className="align-top">
                                    <td className="py-3 pr-3 font-mono text-xs text-body">
                                        {c.numeroSeguimiento || "—"}
                                    </td>
                                    <td className="py-3 pr-3 text-body">{formatCategoria(c.categoria)}</td>
                                    <td className="py-3 pr-3">
                                        <Badge variant="warning">{formatEstado(c.estado)}</Badge>
                                    </td>
                                    <td className="py-3 pr-3 text-muted">
                                        {formatDuracion(c.tiempoDesdeAsignacionMs)}
                                    </td>
                                    <td className="py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                className="px-3 py-1.5 text-xs"
                                                onClick={() => onVerDetalle(c.id)}
                                            >
                                                Ver detalle
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="px-3 py-1.5 text-xs"
                                                onClick={() => onReasignar(c)}
                                            >
                                                Reasignar
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </TablaBody>
                    </Tabla>
                )}
            </GlassCard>
        </section>
    );
}
