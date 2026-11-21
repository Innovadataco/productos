/**
 * Formatos propios de las pantallas del plan (solo presentación; reusa los deterministas del tablero).
 * - `precio`: pesos con los decimales que traiga el dato (un nivel de 9,5 no se redondea a «$ 10», como haría `cop`).
 * - `fechaHora`: «AAAA-MM-DD HH:MM» (ya en Colombia) → «22-jul-2024 a las 15:00».
 */
import { fecha, n, numero } from "../tablero/formato";

const DECIMALES_MAX = 6;
const DECIMAL = /^-?\d+(\.(\d+))?$/;

/** Pesos sin perder decimales: «9.500000» → «$ 9,5»; «1200» → «$ 1.200». Un texto que no es decimal da «—». */
export function precio(s: string | null): string {
  if (s === null) return "—";
  const partes = DECIMAL.exec(s);
  if (!partes) return "—";
  const decimales = Math.min((partes[2] ?? "").replace(/0+$/, "").length, DECIMALES_MAX);
  return `$ ${numero(n(s), decimales)}`;
}

export function fechaHora(enColombia: string): string {
  const [dia = "", hora = ""] = enColombia.split(" ");
  return `${fecha(dia)} a las ${hora}`;
}
