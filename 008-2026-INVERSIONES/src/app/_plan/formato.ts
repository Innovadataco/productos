/**
 * Formatos propios de las pantallas del plan (solo presentación; reusa los deterministas del tablero).
 * - `precio`: pesos con los decimales que traiga el dato, hasta dos (un nivel de 9,5 no se redondea a «$ 10», como haría
 *   `cop`; uno de 6.202,9244 sale «$ 6.202,92»: ningún monto lleva 3 o más decimales).
 * - `fechaHora`: «AAAA-MM-DD HH:MM» (ya en Colombia) → «22-jul-2024 a las 15:00».
 */
import { Prisma } from "@prisma/client";
import { textoPesos } from "@/operar/simulador/textos";
import { fecha } from "../tablero/formato";

const DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * Pesos con hasta dos decimales: «9.500000» → «$ 9,5»; «1200» → «$ 1.200»; «6202.9244» → «$ 6.202,92». Un texto que no es
 * decimal da «—». El redondeo es el de textoPesos (exacto, mitad hacia arriba): una sola implementación para toda la app.
 */
export function precio(s: string | null): string {
  if (s === null || !DECIMAL.test(s)) return "—";
  return textoPesos(new Prisma.Decimal(s));
}

export function fechaHora(enColombia: string): string {
  const [dia = "", hora = ""] = enColombia.split(" ");
  return `${fecha(dia)} a las ${hora}`;
}
