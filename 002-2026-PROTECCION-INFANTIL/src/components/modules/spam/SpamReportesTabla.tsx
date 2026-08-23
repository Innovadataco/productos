"use client";

import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import type { SpamReporteItem } from "./types";

interface SpamReportesTablaProps {
    reportes: SpamReporteItem[];
    loading: boolean;
    page: number;
    totalPages: number;
    total: number;
    onReview: (id: string) => void;
    onPageChange: (page: number) => void;
}

export function SpamReportesTabla({
    reportes,
    loading,
    page,
    totalPages,
    total,
    onReview,
    onPageChange,
}: SpamReportesTablaProps) {
    return (
        <div className="glass rounded-2xl overflow-hidden">
            <Tabla sinContenedor>
                <TablaHead>
                    <tr>
                        <th className="px-4 py-3 font-medium">Identificador</th>
                        <th className="px-4 py-3 font-medium">Plataforma</th>
                        <th className="px-4 py-3 font-medium">Confianza SPAM</th>
                        <th className="px-4 py-3 font-medium">Asignado a</th>
                        <th className="px-4 py-3 font-medium">Recibido</th>
                        <th className="px-4 py-3 font-medium">Acciones</th>
                    </tr>
                </TablaHead>
                <TablaBody>
                    {loading ? (
                        <tr>
                            <td colSpan={6} className="px-4 py-2 text-center text-subtle">
                                <Cargando tamano="sm" />
                            </td>
                        </tr>
                    ) : reportes.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-4 py-2">
                                <EmptyState
                                    title="No hay reportes en revisión de spam"
                                    description="Cuando la IA marque un reporte como posible spam, aparecerá aquí para validación humana."
                                />
                            </td>
                        </tr>
                    ) : (
                        reportes.map((r) => (
                            <tr key={r.id} className="hover:bg-tinta/5 dark:hover:bg-tinta/10 transition">
                                <td className="px-4 py-3 text-body">{r.identificador}</td>
                                <td className="px-4 py-3 text-body">{r.plataforma.nombre}</td>
                                <td className="px-4 py-3 text-body">{(r.confianzaSpam * 100).toFixed(1)}%</td>
                                <td className="px-4 py-3 text-body">{r.asignadoA?.nombre || r.asignadoA?.email || "—"}</td>
                                <td className="px-4 py-3 text-subtle">{new Date(r.creadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td>
                                <td className="px-4 py-3">
                                    <Button onClick={() => onReview(r.id)} variant="outline" className="py-2 px-3 text-xs">
                                        Revisar
                                    </Button>
                                </td>
                            </tr>
                        ))
                    )}
                </TablaBody>
            </Tabla>

            {totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-tinta/10 dark:border-tinta/10 px-4 py-3">
                    <p className="text-sm text-subtle">
                        Página {page} de {totalPages} · {total} reportes
                    </p>
                    <div className="flex gap-2">
                        <Button onClick={() => onPageChange(page - 1)} disabled={page <= 1} variant="outline">
                            Anterior
                        </Button>
                        <Button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} variant="outline">
                            Siguiente
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
