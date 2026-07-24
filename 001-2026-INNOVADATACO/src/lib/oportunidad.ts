/**
 * Utilidades del módulo de Oportunidades (spec 006, US3).
 *
 * Presupuesto DESGLOSADO (FR-008): validación y armado de las partidas para
 * Prisma. Puro y testeable: sin BD ni red.
 */

import { Prisma } from "@prisma/client";

export interface PartidaEntrada {
  concepto?: unknown;
  monto?: unknown;
  moneda?: unknown;
}

/** Convierte a número si es un número válido; si no, null. */
function aNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string" && valor.trim() !== "") {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Valida una lista de partidas. Devuelve un mensaje de error legible si algo no
 * cuadra, o `null` si todo está bien (incluyendo la ausencia de partidas: son
 * opcionales).
 */
export function validarPartidas(partidas: unknown): string | null {
  if (partidas === undefined || partidas === null) return null;
  if (!Array.isArray(partidas)) return "Las partidas deben ser una lista";

  for (const p of partidas as PartidaEntrada[]) {
    if (!p || typeof p !== "object") return "Cada partida debe ser un objeto";
    if (!p.concepto || `${p.concepto}`.trim() === "") {
      return "Cada partida requiere un concepto";
    }
    const monto = aNumero(p.monto);
    if (monto === null) return "El monto de cada partida debe ser un número válido";
    if (monto < 0) return "El monto de una partida no puede ser negativo";
  }
  return null;
}

/**
 * Arma el `create` anidado de partidas para Prisma. Asume que ya pasaron por
 * `validarPartidas`. Devuelve `undefined` si no hay partidas (no crea nada).
 */
export function construirDatosPartidas(
  partidas: unknown,
): Prisma.PartidaPresupuestoCreateNestedManyWithoutLicitacionInput | undefined {
  if (!Array.isArray(partidas) || partidas.length === 0) return undefined;
  return {
    create: (partidas as PartidaEntrada[]).map((p) => ({
      concepto: `${p.concepto}`.trim(),
      monto: new Prisma.Decimal(aNumero(p.monto) ?? 0),
      moneda: p.moneda ? `${p.moneda}`.trim() : "COP",
    })),
  };
}
