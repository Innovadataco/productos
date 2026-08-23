"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import type { DetalleOperadorDto } from "@/lib/dal/types/usuarios-consolidado";
import { fechaCorta } from "@/lib/format/fecha";

function formatDuracionMs(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "—";
    const totalMinutos = Math.floor(ms / 60000);
    const dias = Math.floor(totalMinutos / 1440);
    const horas = Math.floor((totalMinutos % 1440) / 60);
    const minutos = totalMinutos % 60;
    if (dias > 0) return `${dias}d ${horas}h`;
    if (horas > 0) return `${horas}h ${minutos}m`;
    return `${minutos}m`;
}

function formatPorcentaje(value: number | null | undefined): string {
    if (value === null || value === undefined) return "—";
    return `${Math.round(value * 100)}%`;
}

interface DetalleOperadorProps {
    detalle: DetalleOperadorDto;
}

export function DetalleOperador({ detalle }: DetalleOperadorProps) {
    const uso = detalle.cupoMaximo > 0 ? detalle.totalAbiertos / detalle.cupoMaximo : 0;

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">{detalle.nombre || "Sin nombre"}</h1>
                    <p className="text-sm text-muted">
                        {detalle.email} · Operador ·{" "}
                        <Badge variant={detalle.estado === "activo" ? "success" : "neutral"}>{detalle.estado}</Badge>
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/dashboard/admin/operadores/${detalle.id}`}>
                        <Button variant="outline">Editar cupo / gestionar</Button>
                    </Link>
                    <Link href="/dashboard/admin/usuarios/operadores">
                        <Button variant="outline">← Volver</Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Abiertos</p>
                    <p className="mt-1 text-3xl font-bold text-body">{detalle.totalAbiertos}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Cerrados 30d</p>
                    <p className="mt-1 text-3xl font-bold text-body">{detalle.casosResueltos30d}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Tiempo medio resolución</p>
                    <p className="mt-1 text-3xl font-bold text-body">{formatDuracionMs(detalle.tiempoMedioResolucionMs)}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Tasa escalamiento</p>
                    <p className="mt-1 text-3xl font-bold text-body">{formatPorcentaje(detalle.tasaEscalamientoComite)}</p>
                </GlassCard>
            </div>

            <GlassCard className="p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-muted">Cupo actual / máximo</p>
                        <p className="mt-1 text-2xl font-bold text-body">
                            {detalle.totalAbiertos} / {detalle.cupoMaximo}
                        </p>
                    </div>
                    <div className="h-3 w-32 overflow-hidden rounded-full bg-tinta/15 dark:bg-tinta/30">
                        <div
                            className={`h-full rounded-full ${uso >= 1 ? "bg-rubi" : uso >= 0.7 ? "bg-ambar" : "bg-pino"}`}
                            style={{ width: `${Math.min(100, uso * 100)}%` }}
                        />
                    </div>
                </div>
            </GlassCard>

            <GlassCard>
                <h2 className="mb-4 text-lg font-semibold text-body">Casos abiertos</h2>
                {detalle.casosAbiertos.length === 0 ? (
                    <EmptyState title="Sin casos abiertos" description="El operador no tiene casos activos." />
                ) : (
                    <Tabla sinContenedor>
                        <TablaHead variante="borde">
                            <tr className="text-subtle">
                                <th className="pb-3 font-medium">Número</th>
                                <th className="pb-3 font-medium">Estado</th>
                                <th className="pb-3 font-medium">Categoría</th>
                                <th className="pb-3 font-medium">Plataforma</th>
                                <th className="pb-3 font-medium">Asignado</th>
                                <th className="pb-3 font-medium">Tiempo</th>
                            </tr>
                        </TablaHead>
                        <TablaBody>
                            {detalle.casosAbiertos.map((c) => (
                                <tr key={c.id}>
                                    <td className="py-3 pr-3 text-muted">{c.numeroSeguimiento || "—"}</td>
                                    <td className="py-3 pr-3">
                                        <Badge variant="neutral">{c.estado}</Badge>
                                    </td>
                                    <td className="py-3 pr-3 text-muted">{c.categoria || "—"}</td>
                                    <td className="py-3 pr-3 text-muted">{c.plataformaNombre || "—"}</td>
                                    <td className="py-3 pr-3 text-muted">{fechaCorta(c.asignadoEn)}</td>
                                    <td className="py-3 pr-3 text-muted">{formatDuracionMs(c.tiempoDesdeAsignacionMs)}</td>
                                </tr>
                            ))}
                        </TablaBody>
                    </Tabla>
                )}
            </GlassCard>

            {detalle.reasignacionesRecientes.length > 0 && (
                <GlassCard>
                    <h2 className="mb-4 text-lg font-semibold text-body">Histórico de reasignaciones recientes</h2>
                    <ul className="space-y-2 text-sm">
                        {detalle.reasignacionesRecientes.map((r) => (
                            <li key={r.id} className="text-muted">
                                {fechaCorta(r.creadoEn)} · {r.actorNombre || r.actorEmail}
                            </li>
                        ))}
                    </ul>
                </GlassCard>
            )}
        </div>
    );
}
