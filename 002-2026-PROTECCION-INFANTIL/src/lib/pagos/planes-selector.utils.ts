/**
 * SPEC-244 (002-PI-147): utilidades de presentación del selector de planes.
 * Mantiene el cálculo de desglose alineado con el backend
 * (`calculo-totales.service.ts`): subtotal = precioBaseCOP, IVA se suma sobre
 * la base gravable (post-descuento) cuando aplica.
 */

export interface DesgloseVista {
    subtotal: number;
    descuentoBono: number;
    baseGravable: number;
    iva: number;
    total: number;
}

function redondear(valor: number): number {
    return Math.round(valor);
}

export function calcularDesgloseVista(
    precioBaseCOP: number,
    tasaIva: number,
    aplicaIva: boolean,
    descuentoBono = 0
): DesgloseVista {
    const subtotal = Math.max(0, precioBaseCOP);
    const descuento = Math.max(0, descuentoBono);
    const baseGravable = redondear(subtotal - descuento);
    const iva = aplicaIva ? redondear(baseGravable * (tasaIva / 100)) : 0;
    const total = redondear(baseGravable + iva);

    return {
        subtotal,
        descuentoBono: descuento,
        baseGravable,
        iva,
        total,
    };
}

export function formatearCOP(valor: number): string {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(valor);
}
