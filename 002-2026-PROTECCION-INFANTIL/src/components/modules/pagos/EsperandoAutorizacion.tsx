"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Alerta } from "@/components/ui/Alerta";
import type { SuscripcionPendienteDTO } from "@/lib/pagos/planes-selector.types";

interface EsperandoAutorizacionProps {
    suscripcion: SuscripcionPendienteDTO;
}

export function EsperandoAutorizacion({ suscripcion }: EsperandoAutorizacionProps) {
    return (
        <div className="mx-auto w-full max-w-2xl p-4 sm:p-8">
            <GlassCard className="text-center">
                <div
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ambar/10 text-2xl"
                    aria-hidden="true"
                >
                    ⏳
                </div>
                <h1 className="text-2xl font-bold text-body">Solicitud en revisión</h1>
                <p className="mt-2 text-muted">
                    Tu solicitud del plan <strong className="text-body">{suscripcion.plan.nombre}</strong> fue recibida
                    y está pendiente de autorización por nuestro equipo.
                </p>

                <div className="mt-6 rounded-xl bg-white/50 p-4 text-left dark:bg-slate-800/50">
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-muted">Estado</dt>
                            <dd className="font-semibold text-ambar">Pendiente de autorización</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted">Solicitud</dt>
                            <dd className="font-medium text-body">{suscripcion.id.slice(-8).toUpperCase()}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-muted">Fecha de solicitud</dt>
                            <dd className="font-medium text-body">
                                {new Date(suscripcion.fechaInicio).toLocaleDateString("es-CO")}
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="mt-6">
                    <Alerta tono="info" role="status">
                        Te notificaremos por email cuando tu pago sea verificado y el plan quede activo.
                    </Alerta>
                </div>

                {/* Slot reservado para polling de SPEC-247 */}
                <div data-polling-slot="suscripcion-pendiente" className="sr-only">
                    Polling pendiente
                </div>
            </GlassCard>
        </div>
    );
}
