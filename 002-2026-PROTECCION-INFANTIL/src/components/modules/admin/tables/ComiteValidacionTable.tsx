"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { PaginationControls } from "./PaginationControls";
import type { ComiteValidacionListItemDto, PaginacionDto } from "@/lib/dal/types/usuarios-consolidado";

interface ComiteValidacionTableProps {
    items: ComiteValidacionListItemDto[];
    pagination: PaginacionDto;
    page: number;
    onPageChange: (page: number) => void;
}

function ultimasDecisionesTexto(decisiones: ComiteValidacionListItemDto["ultimasDecisiones"]): string {
    if (decisiones.length === 0) return "—";
    return decisiones.map((d) => d.numero).join(", ");
}

export function ComiteValidacionTable({ items, pagination, page, onPageChange }: ComiteValidacionTableProps) {
    return (
        <>
            <Tabla sinContenedor>
                <TablaHead variante="borde">
                    <tr className="text-subtle">
                        <th className="pb-3 font-medium">Nombre</th>
                        <th className="pb-3 font-medium">Casos escalados a plataforma</th>
                        <th className="pb-3 font-medium">Pendientes</th>
                        <th className="pb-3 font-medium">Resueltos</th>
                        <th className="pb-3 font-medium">Últimas decisiones</th>
                        <th className="pb-3 font-medium">Estado</th>
                        <th className="pb-3 font-medium text-right">Acciones</th>
                    </tr>
                </TablaHead>
                <TablaBody>
                    {items.map((u) => (
                        <tr key={u.id} className="align-top">
                            <td className="py-3 pr-3 text-body">
                                <div className="font-medium">{u.nombre || "—"}</div>
                                <div className="text-xs text-muted">{u.email}</div>
                            </td>
                            <td className="py-3 pr-3 text-muted">{u.casosEscaladosPlataforma}</td>
                            <td className="py-3 pr-3 text-muted">{u.casosPendientes}</td>
                            <td className="py-3 pr-3 text-muted">{u.casosResueltos}</td>
                            <td className="py-3 pr-3 text-muted">{ultimasDecisionesTexto(u.ultimasDecisiones)}</td>
                            <td className="py-3 pr-3">
                                <Badge variant={u.estado === "activo" ? "success" : "neutral"}>{u.estado}</Badge>
                            </td>
                            <td className="py-3 text-right">
                                <Link
                                    href={`/dashboard/admin/usuarios/${u.id}`}
                                    className="rounded-lg border border-tinta/20 bg-papel/70 px-3 py-1.5 text-xs text-body hover:bg-tinta/5 dark:border-tinta/30 dark:bg-papel/70 dark:hover:bg-tinta/10"
                                >
                                    Ver detalle
                                </Link>
                            </td>
                        </tr>
                    ))}
                </TablaBody>
            </Tabla>
            <PaginationControls page={page} totalPages={pagination.totalPages} total={pagination.total} onPageChange={onPageChange} />
        </>
    );
}
