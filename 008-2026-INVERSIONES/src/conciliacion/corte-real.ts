/**
 * ¿La certificación es la foto del cierre del día hábil ANTERIOR a su fecha de corte? (frente certificacion-corte-real).
 * Regla pura y única: la usan la importación (señal 1, rechaza con CORTE_NO_COINCIDE) y la conciliación
 * (fecha_corte_dudosa con la fecha sugerida). Solo cuentan las especies COMPARABLES: valoración > 0 y cierre en el corte
 * y en el día hábil anterior (una que no negoció uno de los dos días no apaga la detección: code-reviewer MEDIO).
 * Concluye solo si
 * - hay al menos MIN_ESPECIES_CORTE_REAL comparables (si falta un día entero, o casi, no se puede saber);
 * - todas cuadran con el cierre anterior a ±TOLERANCIA_VERIFICACION (la de la verificación de precios, src/precios/guardar.ts);
 * - ninguna está más cerca del cierre del corte que del anterior (una certificación buena con una especie mal valorada
 *   no pasa: las que valen el cierre del corte la rompen);
 * - y al menos una NO cuadra con el cierre del corte (si no, nada distingue los dos días).
 * Solo mira un día atrás: el mecanismo visto (PDF bajado durante la rueda) da el día hábil anterior, y cada día más
 * atrás sube la probabilidad de un falso positivo en un rechazo que no tiene escape.
 */
import { Prisma } from "@prisma/client";
import { TOLERANCIA_VERIFICACION } from "../precios/guardar";

export const MIN_ESPECIES_CORTE_REAL = 2;

export interface PreciosDeEspecie {
  /** Precio de valoración de la certificación. */
  readonly precioValoracion: string;
  /** Cierre del día de corte, o null. */
  readonly cierre: string | null;
  /** Cierre del día hábil anterior al corte, o null. */
  readonly cierreAnterior: string | null;
}

export interface CorteReal {
  /** Especies comparadas: las certificadas con cierre en los dos días y valoración > 0. */
  readonly especies: number;
  /** De ellas, cuántas no cuadran con el cierre del corte. */
  readonly distintas: number;
}

interface Medida {
  readonly cuadraAnterior: boolean;
  readonly masCercaDelCorte: boolean;
  readonly cuadraCorte: boolean;
}

/** null si a la especie le falta un cierre o su valoración no es positiva: no se compara (no cuenta). */
function medir(e: PreciosDeEspecie): Medida | null {
  if (e.cierre === null || e.cierreAnterior === null) return null;
  const pv = new Prisma.Decimal(e.precioValoracion);
  if (pv.lte(0)) return null;
  const tope = pv.mul(TOLERANCIA_VERIFICACION);
  const alAnterior = new Prisma.Decimal(e.cierreAnterior).sub(pv).abs();
  const alCorte = new Prisma.Decimal(e.cierre).sub(pv).abs();
  return { cuadraAnterior: alAnterior.lte(tope), masCercaDelCorte: alCorte.lt(alAnterior), cuadraCorte: alCorte.lte(tope) };
}

export function corteReal(especies: readonly PreciosDeEspecie[]): CorteReal | null {
  const medidas = especies.map(medir).filter((m): m is Medida => m !== null);
  if (medidas.length < MIN_ESPECIES_CORTE_REAL) return null;
  if (medidas.some((m) => !m.cuadraAnterior || m.masCercaDelCorte)) return null;
  const distintas = medidas.filter((m) => !m.cuadraCorte).length;
  return distintas > 0 ? { especies: medidas.length, distintas } : null;
}
