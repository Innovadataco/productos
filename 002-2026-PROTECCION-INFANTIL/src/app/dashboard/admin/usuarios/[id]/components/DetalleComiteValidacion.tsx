"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import type { DetalleComiteValidacionDto } from "@/lib/dal/types/usuarios-consolidado";
import { fechaCorta } from "@/lib/format/fecha";

function formatPorcentaje(value: number | null | undefined): string {
    if (value === null || value === undefined) return "—";
    return `${Math.round(value * 100)}%`;
}

interface DetalleComiteValidacionProps {
    detalle: DetalleComiteValidacionDto;
}

export function DetalleComiteValidacion({ detalle }: DetalleComiteValidacionProps) {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">{detalle.nombre || "Sin nombre"}</h1>
                    <p className="text-sm text-muted">
                        {detalle.email} · Comité de validación ·{" "}
                        <Badge variant={detalle.estado === "activo" ? "success" : "neutral"}>{detalle.estado}</Badge>
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/dashboard/admin/comite">
                        <Button variant="outline">Ver bandeja de comité</Button>
                    </Link>
                    <Link href="/dashboard/admin/usuarios/comite-validacion">
                        <Button variant="outline">← Volver</Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Casos en curso</p>
                    <p className="mt-1 text-3xl font-bold text-body">{detalle.casosEnCurso}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Pendientes</p>
                    <p className="mt-1 text-3xl font-bold text-body">{detalle.casosPendientes}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Resueltos</p>
                    <p className="mt-1 text-3xl font-bold text-body">{detalle.casosResueltos}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Tasa de resolución</p>
                    <p className="mt-1 text-3xl font-bold text-body">{formatPorcentaje(detalle.tasaResolucion)}</p>
                </GlassCard>
            </div>

            <GlassCard>
                <h2 className="mb-4 text-lg font-semibold text-body">Últimas decisiones</h2>
                {detalle.ultimasDecisiones.length === 0 ? (
                    <EmptyState title="Sin decisiones" description="El comité aún no ha resuelto casos." />
                ) : (
                    <Tabla sinContenedor>
                        <TablaHead variante="borde">
                            <tr className="text-subtle">
                                <th className="pb-3 font-medium">Número</th>
                                <th className="pb-3 font-medium">Estado</th>
                                <th className="pb-3 font-medium">Creado</th>
                                <th className="pb-3 font-medium">Resuelto</th>
                            </tr>
                        </TablaHead>
                        <TablaBody>
                            {detalle.ultimasDecisiones.map((d) => (
                                <tr key={d.id}>
                                    <td className="py-3 pr-3 text-muted">{d.numero}</td>
                                    <td className="py-3 pr-3">
                                        <Badge variant="neutral">{d.estado}</Badge>
                                    </td>
                                    <td className="py-3 pr-3 text-muted">{fechaCorta(d.creadoEn)}</td>
                                    <td className="py-3 pr-3 text-muted">{fechaCorta(d.resueltoEn)}</td>
                                </tr>
                            ))}
                        </TablaBody>
                    </Tabla>
                )}
            </GlassCard>
        </div>
    );
}
