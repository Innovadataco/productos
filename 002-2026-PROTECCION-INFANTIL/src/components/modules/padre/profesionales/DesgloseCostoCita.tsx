/**
 * SPEC-934 (I-450) · Desglose del costo de la cita al padre (FORMA Diseño · Gestión `24ed7aa1` §1, voz tú):
 *
 *     Valor de la consulta                     {{montoConsulta}}
 *     Servicio de la red ({{porcentajeServicio}} %)     {{montoServicio}}
 *     ─────────────────────────────────────────
 *     Total a pagar                            {{montoTotal}}   ← cifra grande, pino, negrita
 *
 * NO calcula nada: pinta montos que vienen del SERVIDOR — en el preview, la `CotizacionCita` de
 * `cotizarCitaNueva` (→ `desglosarTarifa`, la misma función con que `crearSolicitudCita` guarda); en una cita
 * ya creada, los montos GUARDADOS de la fila. Así lo que el padre ve es lo que se cobra (sin recalcular en el
 * cliente, sin otro redondeo). El % sale de `porcentajeServicio` (parámetro), nunca quemado.
 * «Servicio de la red (X %)» es el mismo término del panel del profesional (coherencia D-103(c)).
 */
import type { DesgloseTarifa } from "@/lib/profesional/cita/comision";

const CURRENCY_COP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
});

export function formatearCOP(valor: number): string {
    return CURRENCY_COP.format(valor);
}

/** Etiquetas de la FORMA (Diseño, `24ed7aa1` §1). */
export const ROTULO_CONSULTA = "Valor de la consulta";
export const rotuloServicio = (porcentaje: number) => `Servicio de la red (${porcentaje} %)`;
export const ROTULO_TOTAL = "Total a pagar";

/** Desglose de una cita YA guardada (montos persistidos; nada se recalcula). */
export function desgloseDeCitaGuardada(c: {
    montoConsulta: number;
    montoServicio: number;
    montoTotal: number;
    porcentajeServicio: number;
}): DesgloseTarifa {
    return {
        tarifaProfesional: c.montoConsulta,
        servicioRed: c.montoServicio,
        pagaElPadre: c.montoTotal,
        porcentajeServicio: c.porcentajeServicio,
    };
}

export function DesgloseCostoCita({
    cotizacion,
    rotuloTotal = ROTULO_TOTAL,
}: {
    cotizacion: DesgloseTarifa;
    /** El panel de espera lo cambia a «Monto pagado» cuando el pago está aprobado (FORMA §2). */
    rotuloTotal?: string;
}) {
    return (
        <dl className="mt-2 space-y-1 text-sm" data-testid="desglose-costo-cita">
            <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{ROTULO_CONSULTA}</dt>
                <dd className="cifra text-body">{formatearCOP(cotizacion.tarifaProfesional)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{rotuloServicio(cotizacion.porcentajeServicio)}</dt>
                <dd className="cifra text-body">{formatearCOP(cotizacion.servicioRed)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-tinta/15 pt-2">
                <dt className="font-semibold text-estado-pino">{rotuloTotal}</dt>
                <dd className="cifra text-2xl font-bold text-estado-pino" data-testid="desglose-total">
                    {formatearCOP(cotizacion.pagaElPadre)}
                </dd>
            </div>
        </dl>
    );
}
