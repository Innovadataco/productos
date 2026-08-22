"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { PaginationControls } from "./PaginationControls";
import { formatDuracionMs } from "./utils";
import type { OperadorListItemConsolidadoDto, PaginacionDto } from "@/lib/dal/types/usuarios-consolidado";

interface OperadoresTableProps {
    items: OperadorListItemConsolidadoDto[];
    pagination: PaginacionDto;
    page: number;
    onPageChange: (page: number) => void;
}

export function OperadoresTable({ items, pagination, page, onPageChange }: OperadoresTableProps) {
    return (
        <>
            <Tabla sinContenedor>
                <TablaHead variante="borde">
                    <tr className="text-subtle">
                        <th className="pb-3 font-medium">Nombre</th>
                        <th className="pb-3 font-medium">Cupo</th>
                        <th className="pb-3 font-medium">Casos abiertos</th>
                        <th className="pb-3 font-medium">En proceso</th>
                        <th className="pb-3 font-medium">Cerrados 30d</th>
                        <th className="pb-3 font-medium">Tiempo medio</th>
                        <th className="pb-3 font-medium">Estado</th>
                        <th className="pb-3 font-medium text-right">Acciones</th>
                    </tr>
                </TablaHead>
                <TablaBody>
                    {items.map((op) => {
                        const uso = op.cupoMaximo > 0 ? op.casosAbiertos / op.cupoMaximo : 0;
                        return (
                            <tr key={op.id} className="align-top">
                                <td className="py-3 pr-3 text-body">
                                    <div className="font-medium">{op.nombre || "—"}</div>
                                    <div className="text-xs text-muted">{op.email}</div>
                                </td>
                                <td className="py-3 pr-3 text-muted">{op.cupoMaximo}</td>
                                <td className="py-3 pr-3 text-muted">{op.casosAbiertos}</td>
                                <td className="py-3 pr-3 text-muted">{op.enProceso}</td>
                                <td className="py-3 pr-3 text-muted">{op.cerrados30Dias}</td>
                                <td className="py-3 pr-3 text-muted">{formatDuracionMs(op.tiempoMedioResolucionMs)}</td>
                                <td className="py-3 pr-3">
                                    <Badge variant={op.estado === "activo" ? "success" : "neutral"}>{op.estado}</Badge>
                                </td>
                                <td className="py-3 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <span className="text-xs text-muted">{Math.round(uso * 100)}%</span>
                                        <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                            <div
                                                className={`h-full rounded-full ${
                                                    uso >= 1 ? "bg-red-500" : uso >= 0.7 ? "bg-amber-500" : "bg-emerald-500"
                                                }`}
                                                style={{ width: `${Math.min(100, uso * 100)}%` }}
                                            />
                                        </div>
                                        <Link
                                            href={`/dashboard/admin/usuarios/${op.id}`}
                                            className="rounded-lg border border-tinta/20 bg-papel/70 px-3 py-1.5 text-xs text-body hover:bg-tinta/5 dark:border-tinta/30 dark:bg-papel/70 dark:hover:bg-tinta/10"
                                        >
                                            Ver detalle
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </TablaBody>
            </Tabla>
            <PaginationControls page={page} totalPages={pagination.totalPages} total={pagination.total} onPageChange={onPageChange} />
        </>
    );
}
