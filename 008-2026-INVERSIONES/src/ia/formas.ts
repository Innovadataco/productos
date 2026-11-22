/**
 * Formas de los campos de `hechos-v1`, puras y sin excepciones. Las usan el paquete, la vista ciega y los armadores.
 * No se reusa `canonizarValor` de las series (no admite signo) ni `leerFechaIso` de Trii (recorta espacios).
 */
import { types } from "node:util";
import { MAX_LARGO_DECIMAL, MAX_LARGO_NOMBRE_ESPECIE } from "./contrato";

/** El mismo tope de anidamiento que el JSON canónico y las claves prohibidas. */
const MAX_PROFUNDIDAD = 64;

/** Con signo opcional, sin «-0», sin ceros sobrantes, sin exponente ni separador de miles: «-37911.47», «0», «0.5». */
const DECIMAL_CANONICO = /^-?(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$/;
const DIA_ISO = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
/** Controles, formato invisible (p. ej. U+200B, U+202E), sustitutos sueltos, uso privado y separadores de línea. */
const CARACTER_NO_SEGURO = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/u;
/** Letras, dígitos, espacio y « . & / - ». */
const NOMBRE_ESPECIE = /^[\p{L}\p{N}][\p{L}\p{N} .&/-]*$/u;

export function esDecimalCanonico(texto: string): boolean {
  return texto.length <= MAX_LARGO_DECIMAL && DECIMAL_CANONICO.test(texto) && texto !== "-0";
}

/** «AAAA-MM-DD» de un día que existe (2028-02-29 sí; 2027-02-29 no). */
export function esDiaIso(texto: string): boolean {
  const partes = DIA_ISO.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/** Texto de 1 a `max` caracteres, en NFC, sin caracteres invisibles o de control y sin espacios al borde. */
export function esTextoSeguro(texto: unknown, max: number): texto is string {
  if (typeof texto !== "string" || texto.length === 0 || texto.length > max) return false;
  if (!texto.isWellFormed() || texto.normalize("NFC") !== texto) return false;
  return !CARACTER_NO_SEGURO.test(texto) && texto.trim() === texto;
}

/** Nombre de una especie: texto seguro de hasta 48 caracteres, con letras, dígitos, espacio y « . & / - », sin dobles espacios. */
export function esNombreEspecie(texto: unknown): texto is string {
  return esTextoSeguro(texto, MAX_LARGO_NOMBRE_ESPECIE) && NOMBRE_ESPECIE.test(texto) && !texto.includes("  ");
}

export type Registro = Readonly<Record<string, unknown>>;

/**
 * Objeto plano (prototipo Object o null, no arreglo, no Proxy) cuyas propiedades propias son todas datos: sin getters
 * ni setters. No ejecuta código del objeto: un Proxy se reconoce sin tocar sus trampas.
 */
export function esObjetoPlano(valor: unknown): valor is Registro {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor) || types.isProxy(valor)) return false;
  const prototipo: unknown = Object.getPrototypeOf(valor);
  if (prototipo !== Object.prototype && prototipo !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(valor)).every((descriptor) => "value" in descriptor);
}

function esArregloDeDatos(valor: readonly unknown[], profundidad: number): boolean {
  if (Object.getPrototypeOf(valor) !== Array.prototype) return false;
  const descriptores = Object.getOwnPropertyDescriptors(valor) as Record<string, PropertyDescriptor>;
  const claves = Object.keys(descriptores).filter((clave) => clave !== "length");
  if (claves.length !== valor.length) return false;
  return claves.every((clave, i) => clave === String(i) && "value" in (descriptores[clave] as PropertyDescriptor) && sonDatosPuros(descriptores[clave]?.value, profundidad + 1));
}

/**
 * Datos puros, a todo nivel: texto, booleanos, null, undefined, números finitos, arreglos densos sin propiedades de más
 * y objetos planos; sin Proxy, getters, setters, símbolos, `toJSON` heredado ni más de 64 niveles. Se revisa por
 * descriptores, sin ejecutar código del valor: lo que pasa se lee igual cada vez (no hay lectura doble que engañe).
 */
export function sonDatosPuros(valor: unknown, profundidad = 0): boolean {
  if (valor === null || valor === undefined || typeof valor === "string" || typeof valor === "boolean") return true;
  if (typeof valor === "number") return Number.isFinite(valor);
  if (typeof valor !== "object" || profundidad > MAX_PROFUNDIDAD || types.isProxy(valor)) return false;
  if (Object.getOwnPropertySymbols(valor).length > 0) return false;
  if (Array.isArray(valor)) return esArregloDeDatos(valor, profundidad);
  if (!esObjetoPlano(valor)) return false;
  return Object.values(Object.getOwnPropertyDescriptors(valor)).every((descriptor) => sonDatosPuros(descriptor.value, profundidad + 1));
}

/** ¿Es el valor un texto de la lista? */
export const esDe = <T extends string>(lista: readonly T[], valor: unknown): valor is T => typeof valor === "string" && (lista as readonly string[]).includes(valor);

/** ¿Tiene el registro solo campos de la lista? */
export const soloCampos = (registro: Registro, permitidos: readonly string[]): boolean => Object.keys(registro).every((clave) => permitidos.includes(clave));
