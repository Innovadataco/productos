/**
 * SPEC-216 (002-PI-116): cálculos puros del módulo de pagos.
 * Sin dependencias de Prisma ni E/S; fácilmente testeable.
 */
import type { BonoPromocional, TipoBono } from "@prisma/client";

export interface BonoCalculable {
    tipo: TipoBono;
    valor: number;
}

/**
 * Calcula el descuento en USD que representa un bono sobre un monto base.
 *
 * - DESCUENTO_PCT: porcentaje sobre el monto base.
 * - DESCUENTO_FIJO_USD: valor fijo, nunca superior al monto base.
 * - MESES_GRATIS: `valor` meses gratuitos. Se asume que `montoBaseUSD` es el
 *   valor mensual base; el descuento es `valor * montoBaseUSD`.
 */
export function calcularDescuentoBono(montoBaseUSD: number, bono: BonoCalculable): number {
    if (!Number.isFinite(montoBaseUSD) || montoBaseUSD <= 0) return 0;
    if (!Number.isFinite(bono.valor) || bono.valor < 0) return 0;

    switch (bono.tipo) {
        case "DESCUENTO_PCT": {
            const pct = Math.min(bono.valor, 100);
            return Math.round((montoBaseUSD * pct * 100) / 100) / 100;
        }
        case "DESCUENTO_FIJO_USD":
            return Math.min(bono.valor, montoBaseUSD);
        case "MESES_GRATIS":
            return bono.valor * montoBaseUSD;
        default:
            return 0;
    }
}

/**
 * Cuando un bono NO es combinable con código personal/referido, se aplica
 * el mayor descuento de los dos. Nunca negativo.
 */
export function aplicarMayorDescuento(descuentoBono: number, descuentoReferido: number): number {
    const a = Number.isFinite(descuentoBono) ? descuentoBono : 0;
    const b = Number.isFinite(descuentoReferido) ? descuentoReferido : 0;
    return Math.max(0, Math.max(a, b));
}

export function esBonoPromocional(bono: BonoCalculable | BonoPromocional): bono is BonoPromocional {
    return "id" in bono && typeof bono.id === "string";
}
