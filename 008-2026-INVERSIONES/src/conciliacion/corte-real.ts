/**
 * ¿La certificación es la foto del cierre del día hábil ANTERIOR a su fecha de corte? (frente certificacion-corte-real).
 * Regla pura y única: la usan la importación (señal 1, rechaza con CORTE_NO_COINCIDE) y la conciliación
 * (fecha_corte_dudosa con la fecha sugerida). Concluye solo si
 * - hay al menos MIN_ESPECIES_CORTE_REAL especies certificadas, todas con valoración > 0 y con cierre en el corte y en
 *   el día hábil anterior (si falta uno, no se puede saber);
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
  /** Especies comparadas (todas las certificadas). */
  readonly especies: number;
  /** De ellas, cuántas no cuadran con el cierre del corte. */
  readonly distintas: number;
}

interface Medida {
  readonly cuadraAnterior: boolean;
  readonly masCercaDelCorte: boolean;
  readonly cuadraCorte: boolean;
}

/** null si a la especie le falta un cierre o su valoración no es positiva: no se puede comparar. */
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
  if (especies.length < MIN_ESPECIES_CORTE_REAL) return null;
  const medidas = especies.map(medir);
  if (medidas.some((m) => m === null || !m.cuadraAnterior || m.masCercaDelCorte)) return null;
  const distintas = medidas.filter((m) => m !== null && !m.cuadraCorte).length;
  return distintas > 0 ? { especies: especies.length, distintas } : null;
}
