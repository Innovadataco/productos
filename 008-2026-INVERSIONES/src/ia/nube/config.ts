import "server-only";
/**
 * Configuración de la puerta nube (la API de Claude): la llave y el tope mensual, de DOS variables propias y de nada
 * más del entorno. Nunca se toma `ANTHROPIC_API_KEY` ni otra credencial del entorno de Anthropic.
 *
 * Cierra en apagado: sin llave, o sin tope, la puerta queda apagada (no hay tope por omisión: lo fija Jelk). Un valor
 * mal formado tampoco se corrige ni se recorta: apaga la puerta con su código, que queda en el registro.
 *
 * La llave va envuelta en `LlaveNube`: un campo privado que no sale en JSON, en texto, en `inspect` ni en las claves del
 * objeto. Solo el transporte la revela, para la cabecera del pedido (lo cuida el candado de la frontera).
 */
import { inspect } from "node:util";

/** La llave de la API de Claude (secreto: va en el archivo de secretos de producción, nunca en el repo). */
export const VARIABLE_LLAVE_NUBE = "INV_IA_NUBE_LLAVE";
/** El tope mensual de la puerta nube, en USD con punto decimal (configuración, no secreto). Lo decide Jelk. */
export const VARIABLE_TOPE_NUBE = "INV_IA_NUBE_TOPE_USD";

export const MAX_LARGO_LLAVE_NUBE = 256;
/** ASCII visible, sin espacios: lo que no cumpla apaga la puerta (no se recorta un salto de línea). */
const PATRON_LLAVE = /^[\x21-\x7e]+$/;
/** USD con hasta seis decimales (el micro-USD), sin signo, sin ceros a la izquierda ni exponente. */
const PATRON_USD = /^(0|[1-9][0-9]{0,5})(?:\.([0-9]{1,6}))?$/;
const MICRO_USD_POR_USD = 1_000_000n;
const DECIMALES_MICRO_USD = 6;

/**
 * Techo de cordura del tope: protege de un error de tipeo (p. ej. un «500» por «5.00»). NO es el tope: el tope lo fija
 * Jelk en la configuración; este techo solo rechaza un valor absurdo. Cambiarlo es un cambio de código revisado.
 */
export const TECHO_TOPE_MICRO_USD = 50n * MICRO_USD_POR_USD;

export const CODIGOS_APAGADO_NUBE = Object.freeze([
  "SIN_LLAVE", "LLAVE_INVALIDA", "SIN_TOPE", "TOPE_INVALIDO", "TOPE_FUERA_DE_RANGO", "CLIENTE_NO_CONSTRUIDO",
] as const);
export type CodigoApagadoNube = (typeof CODIGOS_APAGADO_NUBE)[number];

const OCULTA = "[LLAVE_OCULTA]";

/** La llave de la API, envuelta: solo `revelar()` la devuelve. */
export class LlaveNube {
  readonly #valor: string;

  /** Solo `desdeTexto` construye, después de validar. */
  private constructor(valor: string) {
    this.#valor = valor;
    Object.freeze(this);
  }

  /** La llave si el texto es válido (ASCII visible, de 1 a 256 caracteres); si no, null. */
  static desdeTexto(texto: string): LlaveNube | null {
    if (typeof texto !== "string" || texto.length > MAX_LARGO_LLAVE_NUBE || !PATRON_LLAVE.test(texto)) return null;
    return new LlaveNube(texto);
  }

  /** ¿Es una LlaveNube de verdad? La marca es el campo privado: una imitación no lo tiene. */
  static es(valor: unknown): valor is LlaveNube {
    return typeof valor === "object" && valor !== null && #valor in valor;
  }

  /** Solo para la cabecera del pedido (transporte). */
  revelar(): string {
    return this.#valor;
  }

  toJSON(): string {
    return OCULTA;
  }

  toString(): string {
    return OCULTA;
  }

  [inspect.custom](): string {
    return OCULTA;
  }
}

export type ConfigNube =
  | { readonly lista: true; readonly llave: LlaveNube; readonly topeMicroUsd: bigint }
  | { readonly lista: false; readonly detalle: CodigoApagadoNube };

const apagada = (detalle: CodigoApagadoNube): ConfigNube => Object.freeze({ lista: false, detalle });

/** El tope en micro-USD, o null si el texto no tiene la forma (no revisa el rango). */
function topeEnMicroUsd(texto: string): bigint | null {
  const partes = PATRON_USD.exec(texto);
  if (partes === null) return null;
  const enteros = BigInt(partes[1] as string);
  const fraccion = BigInt((partes[2] ?? "").padEnd(DECIMALES_MICRO_USD, "0"));
  return enteros * MICRO_USD_POR_USD + fraccion;
}

/** Revisa el rango del tope: mayor que cero y hasta el techo. */
export function codigoDelTope(topeMicroUsd: unknown): CodigoApagadoNube | null {
  if (typeof topeMicroUsd !== "bigint" || topeMicroUsd <= 0n) return "TOPE_INVALIDO";
  return topeMicroUsd > TECHO_TOPE_MICRO_USD ? "TOPE_FUERA_DE_RANGO" : null;
}

/** La configuración desde el entorno (lee SOLO las dos variables propias). Pura: no lanza. */
export function leerConfigNube(entorno: Readonly<Record<string, string | undefined>>): ConfigNube {
  const textoLlave = entorno[VARIABLE_LLAVE_NUBE];
  const textoTope = entorno[VARIABLE_TOPE_NUBE];
  if (textoLlave === undefined || textoLlave === "") return apagada("SIN_LLAVE");
  const llave = LlaveNube.desdeTexto(textoLlave);
  if (llave === null) return apagada("LLAVE_INVALIDA");
  if (textoTope === undefined || textoTope === "") return apagada("SIN_TOPE");
  const topeMicroUsd = topeEnMicroUsd(textoTope);
  if (topeMicroUsd === null) return apagada("TOPE_INVALIDO");
  const codigo = codigoDelTope(topeMicroUsd);
  return codigo === null ? Object.freeze({ lista: true, llave, topeMicroUsd }) : apagada(codigo);
}
