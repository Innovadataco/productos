"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DetalleRectorDto } from "@/lib/dal/types/usuarios-consolidado";
import { fechaCorta } from "@/lib/format/fecha";

interface DetalleRectorProps {
    detalle: DetalleRectorDto;
}

export function DetalleRector({ detalle }: DetalleRectorProps) {
    const colegio = detalle.colegios[0];

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">{detalle.nombre || "Sin nombre"}</h1>
                    <p className="text-sm text-muted">
                        {detalle.email} · Rector ·{" "}
                        <Badge variant={detalle.estado === "activo" ? "success" : "neutral"}>{detalle.estado}</Badge>
                    </p>
                </div>
                <div className="flex gap-2">
                    {colegio && (
                        <Link href={`/dashboard/admin/estadisticas/operacion/colegios/${colegio.id}`}>
                            <Button variant="outline">Ver ficha colegio</Button>
                        </Link>
                    )}
                    <Link href="/dashboard/admin/usuarios/rectores">
                        <Button variant="outline">← Volver</Button>
                    </Link>
                </div>
            </div>

            {detalle.colegios.length === 0 ? (
                <EmptyState title="Sin colegio asignado" description="Este rector no tiene colegios a cargo." />
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <GlassCard className="p-5">
                            <p className="text-xs text-muted">Colegio</p>
                            <p className="mt-1 text-xl font-bold text-body">{colegio.nombre}</p>
                        </GlassCard>
                        <GlassCard className="p-5">
                            <p className="text-xs text-muted">Alumnos</p>
                            <p className="mt-1 text-2xl font-bold text-body">{colegio.alumnos}</p>
                        </GlassCard>
                        <GlassCard className="p-5">
                            <p className="text-xs text-muted">Profesores</p>
                            <p className="mt-1 text-2xl font-bold text-body">{colegio.profesores}</p>
                        </GlassCard>
                        <GlassCard className="p-5">
                            <p className="text-xs text-muted">Cursos</p>
                            <p className="mt-1 text-2xl font-bold text-body">{colegio.cursos}</p>
                        </GlassCard>
                    </div>

                    <GlassCard>
                        <h2 className="mb-4 text-lg font-semibold text-body">Integrantes por rol</h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <GlassCard className="p-4">
                                <p className="text-xs text-muted">Profesores</p>
                                <p className="mt-1 text-xl font-bold text-body">{colegio.integrantesPorRol.profesores}</p>
                            </GlassCard>
                            <GlassCard className="p-4">
                                <p className="text-xs text-muted">Acudientes</p>
                                <p className="mt-1 text-xl font-bold text-body">{colegio.integrantesPorRol.acudientes}</p>
                            </GlassCard>
                            <GlassCard className="p-4">
                                <p className="text-xs text-muted">Integrantes comité</p>
                                <p className="mt-1 text-xl font-bold text-body">{colegio.integrantesPorRol.integrantesComite}</p>
                            </GlassCard>
                        </div>
                    </GlassCard>
                </>
            )}
        </div>
    );
}
