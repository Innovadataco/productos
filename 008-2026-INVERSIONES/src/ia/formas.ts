/**
 * Formas de los campos de `hechos-v1`, puras y sin excepciones. Las usan el paquete, la vista ciega y los armadores.
 * No se reusa `canonizarValor` de las series (no admite signo) ni `leerFechaIso` de Trii (recorta espacios).
 */
import { MAX_LARGO_DECIMAL, MAX_LARGO_NOMBRE_ESPECIE } from "./contrato";

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

/** Objeto plano (prototipo Object o null, no arreglo) cuyas propiedades propias son todas datos: sin getters ni setters. */
export function esObjetoPlano(valor: unknown): valor is Registro {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return false;
  const prototipo: unknown = Object.getPrototypeOf(valor);
  if (prototipo !== Object.prototype && prototipo !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(valor)).every((descriptor) => "value" in descriptor);
}
