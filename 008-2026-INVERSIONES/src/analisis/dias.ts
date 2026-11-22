/** Días `AAAA-MM-DD` del motor de análisis (medianoche UTC, como las columnas DATE). Puro. */
import type { Dia } from "../proyecciones/tipos";

const DIA_MS = 86_400_000;
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Año, mes (1 a 12) y día de un `AAAA-MM-DD` real; RangeError si no lo es. */
function partes(dia: Dia): { readonly anio: number; readonly mes: number; readonly d: number } {
  const m = FORMATO.exec(dia);
  const [anio, mes, d] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  if (!m || new Date(Date.UTC(anio, mes - 1, d)).toISOString().slice(0, 10) !== dia) throw new RangeError(`Día inválido: «${dia}».`);
  return { anio, mes, d };
}

/** El mismo día `meses` meses antes; si ese mes es más corto, su último día (31 de marzo − 1 mes = 28 o 29 de febrero). */
export function restarMeses(dia: Dia, meses: number): Dia {
  if (!Number.isInteger(meses) || meses < 0) throw new RangeError("Los meses deben ser un entero no negativo.");
  const { anio, mes, d } = partes(dia);
  const indice = anio * 12 + (mes - 1) - meses;
  const [a, m] = [Math.floor(indice / 12), indice % 12];
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/** Días calendario de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: Dia, hasta: Dia): number {
  const t = (x: Dia) => {
    const { anio, mes, d } = partes(x);
    return Date.UTC(anio, mes - 1, d);
  };
  return Math.round((t(hasta) - t(desde)) / DIA_MS);
}
