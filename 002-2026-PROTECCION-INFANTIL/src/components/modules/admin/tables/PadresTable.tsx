"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { PaginationControls } from "./PaginationControls";
import type { PadreListItemDto, PaginacionDto } from "@/lib/dal/types/usuarios-consolidado";

interface PadresTableProps {
    items: PadreListItemDto[];
    pagination: PaginacionDto;
    page: number;
    onPageChange: (page: number) => void;
}

export function PadresTable({ items, pagination, page, onPageChange }: PadresTableProps) {
    return (
        <>
            <Tabla sinContenedor>
                <TablaHead variante="borde">
                    <tr className="text-subtle">
                        <th className="pb-3 font-medium">Nombre</th>
                        <th className="pb-3 font-medium">Email</th>
                        <th className="pb-3 font-medium">Reportes enviados</th>
                        <th className="pb-3 font-medium">Últimos 30d</th>
                        <th className="pb-3 font-medium">Colegios asociados</th>
                        <th className="pb-3 font-medium">Estado</th>
                        <th className="pb-3 font-medium text-right">Acciones</th>
                    </tr>
                </TablaHead>
                <TablaBody>
                    {items.map((u) => (
                        <tr key={u.id} className="align-top">
                            <td className="py-3 pr-3 text-body">{u.nombre || "—"}</td>
                            <td className="py-3 pr-3 text-muted">{u.email}</td>
                            <td className="py-3 pr-3 text-muted">{u.reportesEnviados}</td>
                            <td className="py-3 pr-3 text-muted">{u.reportesUltimos30Dias}</td>
                            <td className="py-3 pr-3 text-muted">
                                {u.colegiosAsociados.map((c) => c.nombre).join(", ") || "—"}
                            </td>
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
