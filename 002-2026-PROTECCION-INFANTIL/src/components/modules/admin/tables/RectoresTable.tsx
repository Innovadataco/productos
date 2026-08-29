"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { PaginationControls } from "./PaginationControls";
import { fechaCorta } from "./utils";
import type { RectorListItemDto, PaginacionDto } from "@/lib/dal/types/usuarios-consolidado";

interface RectoresTableProps {
    items: RectorListItemDto[];
    pagination: PaginacionDto;
    page: number;
    onPageChange: (page: number) => void;
}

export function RectoresTable({ items, pagination, page, onPageChange }: RectoresTableProps) {
    return (
        <>
            <Tabla sinContenedor>
                <TablaHead variante="borde">
                    <tr className="text-subtle">
                        <th className="pb-3 font-medium">Nombre</th>
                        <th className="pb-3 font-medium">Colegio(s) que dirige</th>
                        <th className="pb-3 font-medium">Alumnos</th>
                        <th className="pb-3 font-medium">Profesores</th>
                        <th className="pb-3 font-medium">Cursos</th>
                        <th className="pb-3 font-medium">Reportes del colegio</th>
                        <th className="pb-3 font-medium">Último acceso</th>
                        <th className="pb-3 font-medium text-right">Acciones</th>
                    </tr>
                </TablaHead>
                <TablaBody>
                    {items.map((u) => (
                        <tr key={u.id} className="align-top">
                            <td className="py-3 pr-3 text-body">{u.nombre || "—"}</td>
                            <td className="py-3 pr-3 text-muted">{u.colegio?.nombre || "Sin colegio asignado"}</td>
                            <td className="py-3 pr-3 text-muted">{u.alumnos}</td>
                            <td className="py-3 pr-3 text-muted">{u.profesores}</td>
                            <td className="py-3 pr-3 text-muted">{u.cursos}</td>
                            <td className="py-3 pr-3 text-muted">{u.reportesColegio}</td>
                            <td className="py-3 pr-3 text-muted">{fechaCorta(u.ultimaSesion)}</td>
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
