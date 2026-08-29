"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { PaginationControls } from "./PaginationControls";
import { formatDuracionHoras } from "./utils";
import type { ComiteConvivenciaListItemDto, PaginacionDto } from "@/lib/dal/types/usuarios-consolidado";

interface ComiteConvivenciaTableProps {
    items: ComiteConvivenciaListItemDto[];
    pagination: PaginacionDto;
    page: number;
    onPageChange: (page: number) => void;
}

export function ComiteConvivenciaTable({ items, pagination, page, onPageChange }: ComiteConvivenciaTableProps) {
    return (
        <>
            <Tabla sinContenedor>
                <TablaHead variante="borde">
                    <tr className="text-subtle">
                        <th className="pb-3 font-medium">Nombre</th>
                        <th className="pb-3 font-medium">Colegio asociado</th>
                        <th className="pb-3 font-medium">Integrantes activos</th>
                        <th className="pb-3 font-medium">Casos escalados abiertos</th>
                        <th className="pb-3 font-medium">Resueltos</th>
                        <th className="pb-3 font-medium">Tiempo medio</th>
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
                            <td className="py-3 pr-3 text-muted">{u.colegio?.nombre || "Sin colegio asignado"}</td>
                            <td className="py-3 pr-3 text-muted">{u.integrantesActivos}</td>
                            <td className="py-3 pr-3 text-muted">{u.casosEscaladosAbiertos}</td>
                            <td className="py-3 pr-3 text-muted">{u.casosEscaladosResueltos}</td>
                            <td className="py-3 pr-3 text-muted">{formatDuracionHoras(u.tiempoMedioResolucionHoras)}</td>
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
