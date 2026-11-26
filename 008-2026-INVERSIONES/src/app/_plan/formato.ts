/**
 * Formatos propios de las pantallas del plan (solo presentación; reusa los deterministas del tablero).
 * - `precio`: pesos con los decimales que traiga el dato, hasta dos (un nivel de 9,5 no se redondea a «$ 10», como haría
 *   `cop`; uno de 6.202,9244 sale «$ 6.202,92»: ningún monto lleva 3 o más decimales).
 * - `fechaHora`: «AAAA-MM-DD HH:MM» (ya en Colombia) → «22-jul-2024 a las 15:00».
 */
import { DECIMALES_PESOS_MOSTRADOS } from "@/operar/simulador/tipos";
import { fecha, n, numero } from "../tablero/formato";

const DECIMAL = /^-?\d+(\.(\d+))?$/;

/** Pesos con hasta dos decimales: «9.500000» → «$ 9,5»; «1200» → «$ 1.200»; «6202.9244» → «$ 6.202,92». Un texto que no es decimal da «—». */
export function precio(s: string | null): string {
  if (s === null) return "—";
  const partes = DECIMAL.exec(s);
  if (!partes) return "—";
  const decimales = Math.min((partes[2] ?? "").replace(/0+$/, "").length, DECIMALES_PESOS_MOSTRADOS);
  const texto = numero(n(s), decimales);
  // Sin ceros de más: «1.2004» → «$ 1,2»; lo que redondea a un entero («9.999» → «$ 10») no lleva coma.
  return `$ ${texto.includes(",") ? texto.replace(/,?0+$/, "") : texto}`;
}

export function fechaHora(enColombia: string): string {
  const [dia = "", hora = ""] = enColombia.split(" ");
  return `${fecha(dia)} a las ${hora}`;
}
