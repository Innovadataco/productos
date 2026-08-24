"use client";

import type { VistaSuscripcion } from "@/lib/pagos/suscripcion-vista.types";
import { fechaCorta } from "@/lib/format/fecha";
import { formatoLocal, type Acento } from "./util";

/**
 * SPEC-211 (002-PI-111): bloque 2 — acciones inmediatas. Renovar (si aplica),
 * aviso de pago pendiente de autorización o estado no renovable.
 */
export function SuscripcionAcciones({
    vista,
    acento,
    onRenovar,
}: {
    vista: VistaSuscripcion;
    acento: Acento;
    onRenovar: () => void;
}) {
    if (vista.pagoPendiente) {
        return (
            <div
                data-testid="bloque-acciones"
                className="rounded-2xl border border-ambar/30 bg-ambar/10 p-4 text-sm text-body"
            >
                <p className="font-semibold text-ambar">Tienes un pago pendiente de autorización</p>
                <p className="mt-1 text-muted">
                    Reportado el {fechaCorta(vista.pagoPendiente.fechaReporte)} por{" "}
                    {formatoLocal(vista.pagoPendiente.montoLocalPagado, vista.pagoPendiente.monedaLocal)}. El equipo lo
                    revisará y confirmará tu renovación.
                </p>
            </div>
        );
    }

    if (vista.puedeRenovar) {
        return (
            <div data-testid="bloque-acciones" className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={onRenovar}
                    className={`inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold transition ${acento.boton}`}
                >
                    Renovar suscripción
                </button>
                <p className="text-xs text-subtle">Reporta tu pago con el comprobante para mantener el servicio activo.</p>
            </div>
        );
    }

    if (vista.estado === "CANCELADA") {
        return (
            <div data-testid="bloque-acciones" className="rounded-2xl border border-tinta/20 bg-tinta/5 p-4 text-sm text-muted">
                Tu suscripción está cancelada. Para reactivar el servicio, contacta al equipo de soporte.
            </div>
        );
    }

    return (
        <div
            data-testid="bloque-acciones"
            className="rounded-2xl border border-rubi/30 bg-rubi/10 p-4 text-sm text-body"
        >
            <p className="font-semibold text-rubi">Tu suscripción está suspendida</p>
            <p className="mt-1 text-muted">Contacta al equipo de soporte para regularizar tu estado.</p>
        </div>
    );
}
