/**
 * Los cambios de rango de una operación simulada (paso 1 de «Para revisar», sin IA): los puntos del análisis de antes
 * y de después, la probabilidad de quedar por debajo de lo aportado (si los escenarios se calcularon; si no, ningún
 * lado la tiene) y las reglas de nivel del plan medidas con el precio límite de la orden (solo en el después). Puro.
 */
import type { Prisma } from "@prisma/client";
import type { Analisis } from "../tipos";
import { compararPuntos } from "./comparar";
import { PROBABILIDAD_SIN_CALCULAR, puntoBajoAportado, puntosDelAnalisis, sinCalcularDelAnalisis } from "./calcular";
import { puntosDeNivel, type ReglaDeNivel } from "./nivel";
import type { PuntoCambio } from "./tipos";

export interface EntradaCambios {
  readonly antes: Analisis;
  readonly despues: Analisis;
  /** La probabilidad de los escenarios de cada lado; null si no se calcularon. */
  readonly probabilidad: { readonly antes: number; readonly despues: number } | null;
  readonly reglas: readonly ReglaDeNivel[];
  readonly instrumentoId: string;
  readonly precioLimite: Prisma.Decimal;
  readonly hoy: Date;
}

const pesos = (a: Analisis): Record<string, number> => Object.fromEntries(a.especies.flatMap((e) => (e.peso === null ? [] : [[e.instrumentoId, e.peso] as const])));

export function cambiosDeLaOperacion(e: EntradaCambios): readonly PuntoCambio[] {
  return compararPuntos({
    antes: [...puntosDelAnalisis(e.antes), ...puntoBajoAportado(e.probabilidad?.antes ?? null)],
    despues: [...puntosDelAnalisis(e.despues), ...puntosDeNivel(e.reglas, e.instrumentoId, e.precioLimite, e.hoy), ...puntoBajoAportado(e.probabilidad?.despues ?? null)],
    sinCalcular: {
      antes: [...sinCalcularDelAnalisis(e.antes), ...(e.probabilidad === null ? [PROBABILIDAD_SIN_CALCULAR] : [])],
      despues: [...sinCalcularDelAnalisis(e.despues), ...(e.probabilidad === null ? [PROBABILIDAD_SIN_CALCULAR] : [])],
    },
    pesos: { antes: pesos(e.antes), despues: pesos(e.despues) },
  });
}
