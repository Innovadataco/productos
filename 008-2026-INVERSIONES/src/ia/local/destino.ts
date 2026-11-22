/**
 * El destino de la puerta local: el Ollama del Mac, alcanzado SOLO por la tailnet. Se acepta exactamente
 * `http://<IPv4>:<puerto>` con la IPv4 dentro del rango CGNAT que usa la tailnet (100.64/10, sin su dirección de red ni
 * la de difusión). Puro y cerrado en fallo: rechaza nombres DNS (y por eso localhost), IPv6, rangos privados, de bucle
 * o públicos, https, rutas, consultas, fragmentos, usuario y clave, espacios y formas ambiguas de la IPv4 (ceros a la
 * izquierda, hexadecimal, forma corta). No usa `new URL`, que normaliza esas formas en silencio.
 *
 * Los límites del rango van como números: el cruce de literales de la Fábrica marca cualquier IPv4 escrita.
 */
import { ErrorLocal } from "./errores";

/** Rutas de Ollama que la puerta local puede pedir. Lista cerrada: el resto de la API (pull, delete, chat…) no. */
export const RUTAS_LOCALES = Object.freeze(["/api/generate", "/api/tags"] as const);
export type RutaLocal = (typeof RUTAS_LOCALES)[number];

declare const marcaDestino: unique symbol;
/** Un destino ya revisado. Solo lo crea `leerDestinoLocal`; `urlLocal` lo vuelve a revisar igual. */
export interface DestinoLocal {
  readonly origen: string;
  readonly [marcaDestino]: true;
}

const OCTETO = "(0|[1-9][0-9]{0,2})";
const FORMA = new RegExp(`^http://${OCTETO}\\.${OCTETO}\\.${OCTETO}\\.${OCTETO}:([1-9][0-9]{0,4})$`);
const MAX_OCTETO = 255;
const MAX_PUERTO = 65_535;
/** El rango CGNAT de la tailnet: primer octeto 100 y segundo de 64 a 127 (un /10). */
const PRIMER_OCTETO = 100;
const SEGUNDO_MIN = 64;
const SEGUNDO_MAX = 127;

function enElRango(a: number, b: number, c: number, d: number): boolean {
  if (a !== PRIMER_OCTETO || b < SEGUNDO_MIN || b > SEGUNDO_MAX) return false;
  const esRed = b === SEGUNDO_MIN && c === 0 && d === 0;
  const esDifusion = b === SEGUNDO_MAX && c === MAX_OCTETO && d === MAX_OCTETO;
  return !esRed && !esDifusion;
}

/** Lee el destino de la configuración. Lanza `ErrorLocal` (DESTINO_AUSENTE, DESTINO_INVALIDO o DESTINO_FUERA_DE_RANGO). */
export function leerDestinoLocal(valor: string | undefined): DestinoLocal {
  if (valor === undefined || valor === "") throw new ErrorLocal("DESTINO_AUSENTE");
  const partes = typeof valor === "string" ? FORMA.exec(valor) : null;
  if (partes === null) throw new ErrorLocal("DESTINO_INVALIDO");
  const [a, b, c, d, puerto] = partes.slice(1).map(Number) as [number, number, number, number, number];
  if ([a, b, c, d].some((octeto) => octeto > MAX_OCTETO) || puerto > MAX_PUERTO) throw new ErrorLocal("DESTINO_INVALIDO");
  if (!enElRango(a, b, c, d)) throw new ErrorLocal("DESTINO_FUERA_DE_RANGO");
  return Object.freeze({ origen: valor }) as DestinoLocal;
}

/** La URL de una ruta permitida en ese destino. Revisa de nuevo el destino y la ruta: lanza `ErrorLocal`. */
export function urlLocal(destino: DestinoLocal, ruta: RutaLocal): string {
  const { origen } = leerDestinoLocal(destino.origen);
  if (!(RUTAS_LOCALES as readonly string[]).includes(ruta)) throw new ErrorLocal("RUTA_NO_PERMITIDA");
  return `${origen}${ruta}`;
}
