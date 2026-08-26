/**
 * SPEC-261 (002-PI-164): fuente única de los estados que componen la carga de trabajo
 * del operador. Toda consulta o guarda que filtre por "bandeja del operador" debe
 * referenciar esta constante en lugar de repetir literales.
 */
import type { EstadoReporte } from "@prisma/client";

export const ESTADOS_CARGA_OPERADOR = [
    "REVISION_MANUAL",
    "POSIBLE_SPAM",
] as const satisfies readonly EstadoReporte[];

export type EstadoCargaOperador = (typeof ESTADOS_CARGA_OPERADOR)[number];

export function esEstadoCargaOperador(estado: EstadoReporte): estado is EstadoCargaOperador {
    return (ESTADOS_CARGA_OPERADOR as readonly EstadoReporte[]).includes(estado);
}
