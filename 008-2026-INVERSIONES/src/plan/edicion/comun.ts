/**
 * Piezas comunes de los lectores del borde del área de edición (fase B, PR-B). Puras: sin base ni Next.
 * Solo convierten el JSON del formulario en los tipos del dominio y ponen topes de tamaño; la semántica la validan
 * las funciones del dominio (src/plan/validar.ts), las mismas del importador de la ficha. Los números se leen como
 * los lee la ficha (src/plan/importar/valores-es.ts) y las fechas, en ISO (src/importacion/trii/valores.ts).
 * Los errores llevan solo campo y código, nunca el valor (son datos reales del dueño).
 */
import type { ErrorCampo } from "../errores";
import { leerEnteroEs, leerMontoEs } from "../importar/valores-es";
import { leerFechaIso } from "../../importacion/trii/valores";
import { MAX_TEXTO } from "../validar";

/** Reglas por versión: el plan real tiene decenas; el tope solo evita pedidos absurdos. */
export const MAX_REGLAS = 100;
/** BIGINT de PostgreSQL: una cantidad mayor daría un 500 de la base (22003); se rechaza aquí con su campo. */
export const MAX_CANTIDAD = 9_223_372_036_854_775_807n;
/**
 * Un texto de MAX_TEXTO caracteres escritos (UTF-8, hasta 4 bytes por carácter) cabe en esto. Un carácter de control
 * escapado en JSON (`\u0001`) ocupa 6: un texto hecho solo de ellos puede pasar el tope del cuerpo y salir como
 * solicitud inválida (400) en vez de DEMASIADO_LARGO; desde el formulario no se escriben.
 */
const BYTES_POR_TEXTO = MAX_TEXTO * 4;
/** Lo demás de una regla o de una decisión (claves, ids, fechas, números) cabe de sobra en 1 KB. */
const BYTES_SIN_TEXTOS = 1024;
/** Topes del cuerpo de cada ruta, derivados de los topes de los campos. */
export const MAX_CUERPO_VERSION = BYTES_POR_TEXTO + MAX_REGLAS * (BYTES_POR_TEXTO + BYTES_SIN_TEXTOS);
export const MAX_CUERPO_DECISION = BYTES_POR_TEXTO + BYTES_SIN_TEXTOS;
export const MAX_CUERPO_ENLACE = BYTES_SIN_TEXTOS;

/** Los ids de la base son cuid (minúsculas y dígitos); el guion se admite para los de las pruebas. */
const ID = /^[a-z0-9-]{1,64}$/;
/** Un enum del esquema (la base dice cuál vale): solo mayúsculas y guion bajo, corto. */
const ENUM = /^[A-Z_]{1,32}$/;
const MAX_VERSION = 1_000_000_000;

export type Lectura<T> = { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly errores: readonly ErrorCampo[] };

/** Un acumulador de errores por campo: cada lector devuelve su valor (o `undefined`) y anota su error. */
export class Errores {
  readonly lista: ErrorCampo[] = [];

  anotar(campo: string, codigo: string): undefined {
    this.lista.push({ campo, codigo });
    return undefined;
  }

  get hay(): boolean {
    return this.lista.length > 0;
  }
}

/** Un objeto plano con EXACTAMENTE esas claves, comparadas una por una (ni una de más: el autor sale de la sesión). */
export function objetoConClaves(valor: unknown, claves: readonly string[]): Record<string, unknown> | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  const registro = valor as Record<string, unknown>;
  const propias = Object.keys(registro);
  return propias.length === claves.length && claves.every((c) => Object.hasOwn(registro, c)) ? registro : null;
}

/** PostgreSQL no guarda el carácter nulo en un texto (22021): se rechaza aquí, con su campo. */
const NULO = "\u0000";

export function texto(e: Errores, campo: string, v: unknown): string | undefined {
  if (typeof v !== "string" || v.includes(NULO)) return e.anotar(campo, "FORMATO_INVALIDO");
  return v.length > MAX_TEXTO ? e.anotar(campo, "DEMASIADO_LARGO") : v;
}

export function id(e: Errores, campo: string, v: unknown): string | undefined {
  return typeof v === "string" && ID.test(v) ? v : e.anotar(campo, "ID_INVALIDO");
}

/** Un id o nulo (también el texto vacío del formulario). */
export function idOpcional(e: Errores, campo: string, v: unknown): string | null | undefined {
  return v === null || v === "" ? null : id(e, campo, v);
}

/** El valor de un enum como texto; si es del enum o no, lo dice el dominio (con su código). */
export function enumerado<T extends string>(e: Errores, campo: string, v: unknown): T | undefined {
  return typeof v === "string" && ENUM.test(v) ? (v as T) : e.anotar(campo, "FORMATO_INVALIDO");
}

export function fecha(e: Errores, campo: string, v: unknown): Date | undefined {
  const r = typeof v === "string" ? leerFechaIso(v) : null;
  return r?.ok ? r.valor : e.anotar(campo, "FECHA_INVALIDA");
}

/** Una fecha o nula (el texto vacío del formulario). */
export function fechaOpcional(e: Errores, campo: string, v: unknown): Date | null | undefined {
  return v === null || v === "" ? null : fecha(e, campo, v);
}

const vacio = (v: unknown): boolean => v === null || (typeof v === "string" && v.trim() === "");

/** «1.237,5», «$7,3 M» → texto decimal, con la lectura de la ficha; vacío → nulo. Nunca adivina («1.5» no). */
export function nivel(e: Errores, campo: string, v: unknown): string | null | undefined {
  if (vacio(v)) return null;
  const leido = typeof v === "string" && v.length <= 64 ? leerMontoEs(v) : null;
  return leido ?? e.anotar(campo, "NIVEL_NO_RECONOCIDO");
}

/** «4.613» → 4613n, con la lectura de la ficha; vacío → nulo; que quepa en la columna (BIGINT). */
export function cantidad(e: Errores, campo: string, v: unknown): bigint | null | undefined {
  if (vacio(v)) return null;
  const leida = typeof v === "string" && v.length <= 64 ? leerEnteroEs(v) : null;
  if (leida === null) return e.anotar(campo, "CANTIDAD_NO_RECONOCIDA");
  return leida > MAX_CANTIDAD ? e.anotar(campo, "CANTIDAD_INVALIDA") : leida;
}

export function booleano(e: Errores, campo: string, v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : e.anotar(campo, "FORMATO_INVALIDO");
}

/** El número de una versión (0 = todavía no había ninguna). */
export function numeroDeVersion(e: Errores, campo: string, v: unknown): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_VERSION ? v : e.anotar(campo, "FORMATO_INVALIDO");
}

export const CUERPO_INVALIDO: Lectura<never> = { ok: false, errores: [{ campo: "cuerpo", codigo: "FORMATO_INVALIDO" }] };
