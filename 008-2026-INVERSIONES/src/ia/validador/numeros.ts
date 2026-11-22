/**
 * Números escritos en palabras y fundidos en una sola («dosmil», «unmillon», «treintaycinco»): los patrones de palabra
 * completa no los ven. Una palabra es un número fundido si se puede partir entera en dos o más piezas de numeral (con
 * «y» entre ellas o no). Se revisa palabra por palabra (hasta `maxLargoPalabra` letras: las más largas ya son FORMATO),
 * con programación dinámica: sin expresiones con retroceso.
 */
import { LIMITES_SALIDA } from "./codigos";

const PIEZAS: readonly string[] = Object.freeze([
  "un", "uno", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce",
  "quince", "dieci", "veinte", "veinti", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa", "cien", "ciento",
  "cientos", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos", "mil",
  "miles", "millon", "millones", "billon", "billones", "trillon", "trillones", "y",
]);
const MIN_PIEZAS = 2;

/** ¿La palabra (en minúsculas y sin tildes) es entera una sucesión de dos o más piezas de numeral? */
export function esNumeroFundido(palabra: string): boolean {
  if (palabra.length > LIMITES_SALIDA.maxLargoPalabra) return false;
  // piezas[i]: el mayor número de piezas con que se parte el prefijo de largo i (−1 si no se puede).
  const piezas: number[] = Array.from({ length: palabra.length + 1 }, () => -1);
  piezas[0] = 0;
  for (let i = 0; i < palabra.length; i += 1) {
    const hasta = piezas[i] as number;
    if (hasta < 0) continue;
    for (const pieza of PIEZAS) {
      if (palabra.startsWith(pieza, i)) piezas[i + pieza.length] = Math.max(piezas[i + pieza.length] as number, hasta + 1);
    }
  }
  return (piezas[palabra.length] as number) >= MIN_PIEZAS;
}
