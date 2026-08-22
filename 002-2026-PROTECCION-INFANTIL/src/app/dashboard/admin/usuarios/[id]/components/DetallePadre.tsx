"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import type { DetallePadreDto } from "@/lib/dal/types/usuarios-consolidado";

function fechaCorta(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

interface DetallePadreProps {
    detalle: DetallePadreDto;
}

export function DetallePadre({ detalle }: DetallePadreProps) {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">{detalle.nombre || "Sin nombre"}</h1>
                    <p className="text-sm text-muted">
                        {detalle.email} · Padre ·{" "}
                        <Badge variant={detalle.estado === "activo" ? "success" : "neutral"}>{detalle.estado}</Badge>
                    </p>
                </div>
                <Link href="/dashboard/admin/usuarios">
                    <Button variant="outline">← Volver</Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Reportes enviados</p>
                    <p className="mt-1 text-2xl font-bold text-body">{detalle.reportes.total}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Registro</p>
                    <p className="mt-1 text-2xl font-bold text-body">{fechaCorta(detalle.creadoEn)}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Última sesión</p>
                    <p className="mt-1 text-2xl font-bold text-body">{fechaCorta(detalle.ultimaSesion)}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Colegios asociados</p>
                    <p className="mt-1 text-2xl font-bold text-body">{detalle.colegiosAsociados.length}</p>
                </GlassCard>
            </div>

            <GlassCard>
                <h2 className="mb-4 text-lg font-semibold text-body">Colegios asociados</h2>
                {detalle.colegiosAsociados.length === 0 ? (
                    <p className="text-sm text-muted">Sin colegios asociados.</p>
                ) : (
                    <ul className="space-y-2">
                        {detalle.colegiosAsociados.map((c) => (
                            <li key={c.id} className="text-body">{c.nombre}</li>
                        ))}
                    </ul>
                )}
            </GlassCard>

            <GlassCard>
                <h2 className="mb-4 text-lg font-semibold text-body">Historial de reportes (metadatos)</h2>
                {detalle.reportes.items.length === 0 ? (
                    <EmptyState title="Sin reportes" description="Este usuario no ha enviado reportes." />
                ) : (
                    <>
                        <Tabla sinContenedor>
                            <TablaHead variante="borde">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Número</th>
                                    <th className="pb-3 font-medium">Estado</th>
                                    <th className="pb-3 font-medium">Fecha</th>
                                    <th className="pb-3 font-medium">Plataforma</th>
                                    <th className="pb-3 font-medium">Clasificación</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {detalle.reportes.items.map((r) => (
                                    <tr key={r.id}>
                                        <td className="py-3 pr-3 text-muted">{r.numeroSeguimiento || "—"}</td>
                                        <td className="py-3 pr-3">
                                            <Badge variant="neutral">{r.estado}</Badge>
                                        </td>
                                        <td className="py-3 pr-3 text-muted">{fechaCorta(r.creadoEn)}</td>
                                        <td className="py-3 pr-3 text-muted">{r.plataforma?.nombre || "—"}</td>
                                        <td className="py-3 pr-3 text-muted">{r.clasificacion?.categoria || "—"}</td>
                                    </tr>
                                ))}
                            </TablaBody>
                        </Tabla>
                        <p className="mt-4 text-sm text-muted">
                            Mostrando {detalle.reportes.items.length} de {detalle.reportes.total} reportes.
                        </p>
                    </>
                )}
            </GlassCard>
        </div>
    );
}
