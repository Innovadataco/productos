"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import type { DetalleComiteConvivenciaDto } from "@/lib/dal/types/usuarios-consolidado";

function fechaCorta(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function formatDuracionHoras(horas: number | null | undefined): string {
    if (horas === null || horas === undefined) return "—";
    if (horas < 1) return `${Math.round(horas * 60)} min`;
    if (horas < 24) return `${Math.round(horas)} h`;
    return `${Math.round(horas / 24)} d`;
}

interface DetalleComiteConvivenciaProps {
    detalle: DetalleComiteConvivenciaDto;
}

export function DetalleComiteConvivencia({ detalle }: DetalleComiteConvivenciaProps) {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">{detalle.nombre || "Sin nombre"}</h1>
                    <p className="text-sm text-muted">
                        {detalle.email} · Comité de convivencia ·{" "}
                        <Badge variant={detalle.estado === "activo" ? "success" : "neutral"}>{detalle.estado}</Badge>
                    </p>
                </div>
                <div className="flex gap-2">
                    {detalle.colegio && (
                        <Link href={`/dashboard/admin/estadisticas/operacion/colegios/${detalle.colegio.id}`}>
                            <Button variant="outline">Ver ficha colegio</Button>
                        </Link>
                    )}
                    <Link href="/dashboard/admin/usuarios/comite-convivencia">
                        <Button variant="outline">← Volver</Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Colegio asociado</p>
                    <p className="mt-1 text-xl font-bold text-body">{detalle.colegio?.nombre || "—"}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Integrantes activos</p>
                    <p className="mt-1 text-3xl font-bold text-body">{detalle.integrantesActivos}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Casos resueltos</p>
                    <p className="mt-1 text-3xl font-bold text-body">{detalle.casosResueltos}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Tiempo medio resolución</p>
                    <p className="mt-1 text-3xl font-bold text-body">{formatDuracionHoras(detalle.tiempoMedioResolucionHoras)}</p>
                </GlassCard>
            </div>

            <GlassCard>
                <h2 className="mb-4 text-lg font-semibold text-body">Operadores del colegio</h2>
                {detalle.operadoresAsignados.length === 0 ? (
                    <EmptyState title="Sin operadores" description="No hay operadores asignados a este colegio." />
                ) : (
                    <ul className="space-y-2">
                        {detalle.operadoresAsignados.map((op) => (
                            <li key={op.id} className="text-body">
                                {op.nombre || op.email} ({op.email})
                            </li>
                        ))}
                    </ul>
                )}
            </GlassCard>

            <GlassCard>
                <h2 className="mb-4 text-lg font-semibold text-body">Casos escalados</h2>
                {detalle.casosEscalados.length === 0 ? (
                    <EmptyState title="Sin casos escalados" description="No hay casos escalados a este comité." />
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
                            {detalle.casosEscalados.map((c) => (
                                <tr key={c.id}>
                                    <td className="py-3 pr-3 text-muted">{c.numero}</td>
                                    <td className="py-3 pr-3">
                                        <Badge variant="neutral">{c.estado}</Badge>
                                    </td>
                                    <td className="py-3 pr-3 text-muted">{fechaCorta(c.creadoEn)}</td>
                                    <td className="py-3 pr-3 text-muted">{fechaCorta(c.resueltoEn)}</td>
                                </tr>
                            ))}
                        </TablaBody>
                    </Tabla>
                )}
            </GlassCard>
        </div>
    );
}
