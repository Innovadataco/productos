/**
 * Rendimiento por dividendo de 12 meses y próxima fecha ex de una especie. Puro.
 * - Dividendos por acción de `dividendosPorAccion` (src/proyecciones/dividendos.ts, la regla de la historia y del plan)
 *   con pago en (hoy − 12 meses, hoy], sumados y divididos por el último cierre del tablero.
 * - Próxima fecha ex: el decreto que cuenta con la fecha ex más próxima, hoy o después (en un empate, por id).
 */
import type { Prisma } from "@prisma/client";
import type { AccionEntrada, Dia } from "../proyecciones/tipos";
import type { RendimientoDividendo } from "./tipos";

export function rendimientoDividendo12m(accion: AccionEntrada, hoy: Date, ultimoCierre: Prisma.Decimal): RendimientoDividendo {
  throw new Error("sin implementar");
}

export function proximaFechaEx(accion: AccionEntrada, hoy: Date): { readonly dia: Dia; readonly decretoId: string } | null {
  throw new Error("sin implementar");
}
