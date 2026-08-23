"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import type { DetalleAdminDto } from "@/lib/dal/types/usuarios-consolidado";
import { fechaCorta } from "@/lib/format/fecha";

interface DetalleAdminProps {
    detalle: DetalleAdminDto;
}

export function DetalleAdmin({ detalle }: DetalleAdminProps) {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-body">{detalle.nombre || "Sin nombre"}</h1>
                    <p className="text-sm text-muted">
                        {detalle.email} · Admin ·{" "}
                        <Badge variant={detalle.estado === "activo" ? "success" : "neutral"}>{detalle.estado}</Badge>
                    </p>
                </div>
                <Link href="/dashboard/admin/usuarios/admins">
                    <Button variant="outline">← Volver</Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Registro</p>
                    <p className="mt-1 text-2xl font-bold text-body">{fechaCorta(detalle.creadoEn)}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Última sesión</p>
                    <p className="mt-1 text-2xl font-bold text-body">{fechaCorta(detalle.ultimaSesion)}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Módulos gestionados</p>
                    <p className="mt-1 text-2xl font-bold text-body">{detalle.modulosGestionados.length}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Acciones recientes</p>
                    <p className="mt-1 text-2xl font-bold text-body">{detalle.ultimasAcciones.length}</p>
                </GlassCard>
            </div>

            <GlassCard>
                <h2 className="mb-4 text-lg font-semibold text-body">Módulos gestionados</h2>
                {detalle.modulosGestionados.length === 0 ? (
                    <p className="text-sm text-muted">Sin módulos asignados.</p>
                ) : (
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {detalle.modulosGestionados.map((m) => (
                            <li key={m.clave} className="text-body">{m.nombre}</li>
                        ))}
                    </ul>
                )}
            </GlassCard>

            <GlassCard>
                <h2 className="mb-4 text-lg font-semibold text-body">Últimas acciones sensibles</h2>
                {detalle.ultimasAcciones.length === 0 ? (
                    <EmptyState title="Sin acciones" description="No se registraron acciones recientes." />
                ) : (
                    <Tabla sinContenedor>
                        <TablaHead variante="borde">
                            <tr className="text-subtle">
                                <th className="pb-3 font-medium">Acción</th>
                                <th className="pb-3 font-medium">Recurso</th>
                                <th className="pb-3 font-medium">Fecha</th>
                            </tr>
                        </TablaHead>
                        <TablaBody>
                            {detalle.ultimasAcciones.map((a) => (
                                <tr key={a.id}>
                                    <td className="py-3 pr-3 text-muted">{a.accion}</td>
                                    <td className="py-3 pr-3 text-muted">{a.tipoRecurso} {a.recursoId ? `#${a.recursoId.slice(0, 8)}` : "—"}</td>
                                    <td className="py-3 pr-3 text-muted">{fechaCorta(a.creadoEn)}</td>
                                </tr>
                            ))}
                        </TablaBody>
                    </Tabla>
                )}
            </GlassCard>
        </div>
    );
}
