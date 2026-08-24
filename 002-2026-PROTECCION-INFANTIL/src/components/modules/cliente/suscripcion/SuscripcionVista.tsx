"use client";

import { useState } from "react";
import type { ColorRol, VistaSuscripcion } from "@/lib/pagos/suscripcion-vista.types";
import { ACENTOS } from "./util";
import { SuscripcionResumen } from "./SuscripcionResumen";
import { SuscripcionAcciones } from "./SuscripcionAcciones";
import { HistorialPagos } from "./HistorialPagos";
import { CodigoReferidoCard } from "./CodigoReferidoCard";
import { AplicarBonoCard } from "./AplicarBonoCard";
import { ContratoCard } from "./ContratoCard";
import { CancelarSuscripcion } from "./CancelarSuscripcion";
import { RenovacionForm } from "./RenovacionForm";

/**
 * SPEC-211 (002-PI-111): composición de los 7 bloques estándar de la vista de
 * suscripción del cliente (BRIEF §8.2/§8.3) + formulario de renovación.
 * La misma vista sirve a rector (pino) y padre (cielo); el bloque de contrato
 * se muestra según el tipo de titular y la configuración (FR-003).
 */
export function SuscripcionVista({
    vista,
    color,
    mostrarContrato,
}: {
    vista: VistaSuscripcion;
    color: ColorRol;
    mostrarContrato: boolean;
}) {
    const acento = ACENTOS[color];
    const [mostrarRenovacion, setMostrarRenovacion] = useState(false);

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-8">
            <header>
                <h1 className="text-2xl font-bold text-body">Mi suscripción</h1>
                <p className="mt-1 text-sm text-muted">Estado del servicio, pagos y beneficios de tu cuenta.</p>
            </header>

            {/* 1. Resumen ejecutivo */}
            <SuscripcionResumen vista={vista} />

            {/* 2. Acciones inmediatas / formulario de renovación */}
            {mostrarRenovacion ? (
                <RenovacionForm
                    suscripcionId={vista.id}
                    opciones={vista.opcionesRenovacion}
                    limites={vista.limitesComprobante}
                    descuentoReferidoPct={vista.descuentoReferidoPct}
                    acento={acento}
                    onCerrar={() => setMostrarRenovacion(false)}
                />
            ) : (
                <SuscripcionAcciones vista={vista} acento={acento} onRenovar={() => setMostrarRenovacion(true)} />
            )}

            {/* 4 + 5. Código de referido y bono, lado a lado en desktop */}
            <div className="grid gap-6 lg:grid-cols-2">
                <CodigoReferidoCard
                    codigo={vista.codigoReferidoPropio}
                    referidosExitososEsteAnio={vista.referidosExitososEsteAnio}
                    acento={acento}
                />
                <AplicarBonoCard suscripcionId={vista.id} montoBaseUSD={vista.plan.precioBaseUSD} acento={acento} />
            </div>

            {/* 3. Historial de pagos */}
            <HistorialPagos pagos={vista.pagos} monedaLocal={vista.monedaLocal} />

            {/* 6. Contrato firmado (colegio siempre; padre según configuración) */}
            {mostrarContrato && (
                <ContratoCard contratoPDFUrl={vista.contratoPDFUrl} contratoObligatorio={vista.contratoObligatorio} />
            )}

            {/* 7. Cancelar suscripción */}
            <CancelarSuscripcion suscripcionId={vista.id} estadoActual={vista.estado} />
        </div>
    );
}
