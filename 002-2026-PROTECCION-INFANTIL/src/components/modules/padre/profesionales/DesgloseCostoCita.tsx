/**
 * SPEC-934 (I-450) · Desglose del costo de la cita al padre: consulta + servicio de la red = total.
 *
 * Recibe la `CotizacionCita` que calcula el SERVIDOR (`cotizarCitaNueva` → `desglosarTarifa`), la misma
 * función que `crearSolicitudCita` usa para guardar `montoTotal`. Así el total que el padre ve y acepta es
 * exactamente el que se guarda y se cobrará (D-103(c): tarifa + porcentaje de la red).
 *
 * COPY PROVISIONAL: las etiquetas las define Diseño (pedidas por el CEO). Voz tú (padre).
 */
import type { CotizacionCita } from "@/lib/profesional/cita/cotizacion-cita";

const CURRENCY_COP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
});

export function formatearCOP(valor: number): string {
    return CURRENCY_COP.format(valor);
}

export function DesgloseCostoCita({ cotizacion }: { cotizacion: CotizacionCita }) {
    return (
        <dl className="mt-2 space-y-1 text-sm" data-testid="desglose-costo-cita">
            <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Consulta</dt>
                <dd className="cifra text-body">{formatearCOP(cotizacion.tarifaProfesional)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Servicio de la red ({cotizacion.porcentajeServicio} %)</dt>
                <dd className="cifra text-body">{formatearCOP(cotizacion.servicioRed)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-tinta/15 pt-1">
                <dt className="font-semibold text-body">Total</dt>
                <dd className="cifra font-bold text-body" data-testid="desglose-total">
                    {formatearCOP(cotizacion.pagaElPadre)}
                </dd>
            </div>
        </dl>
    );
}
