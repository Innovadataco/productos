/**
 * Valores de las celdas de la certificación de A&V. Formato del portal: montos «COP 1.234,56» (punto de miles,
 * coma decimal, siempre dos decimales), cantidades enteras, NIT con dígito de verificación e identificadores en
 * dígitos. Devuelven texto decimal canónico (el de `leerDecimal` de Trii) o un código, nunca lanzan.
 */
import { ESCALA_MONTO, leerDecimal, type ResultadoValor } from "../trii/valores";

const MONTO = /^COP\s?(-)?(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})$/;
const CANTIDAD = /^(\d{1,3}(?:\.\d{3})+|\d+)$/;
const NIT = /^\d{6,10}-\d$/;
const MAX_DIGITOS = 20;

/** «COP 1.234,56» → «1234.56». Un negativo solo vale si `negativo` (el saldo en efectivo puede serlo). */
export function leerMontoCop(texto: string, opciones: { readonly negativo?: boolean; readonly escala?: number } = {}): ResultadoValor<string> {
  const m = MONTO.exec(texto.trim());
  if (!m) return { ok: false, codigo: "MONTO_FORMATO" };
  if (m[1] && !opciones.negativo) return { ok: false, codigo: "MONTO_NEGATIVO" };
  const r = leerDecimal(`${m[1] ?? ""}${m[2]!.replace(/\./g, "")}.${m[3]}`, opciones.escala ?? ESCALA_MONTO);
  return r.ok ? r : { ok: false, codigo: "MONTO_FORMATO" };
}

/** Cantidad de acciones: entera y positiva, con o sin punto de miles. */
export function leerCantidadAcciones(texto: string): ResultadoValor<bigint> {
  const m = CANTIDAD.exec(texto.trim());
  if (!m) return { ok: false, codigo: "CANTIDAD_FORMATO" };
  const valor = BigInt(m[1]!.replace(/\./g, ""));
  return valor > 0n ? { ok: true, valor } : { ok: false, codigo: "CANTIDAD_FORMATO" };
}

export function leerNit(texto: string): ResultadoValor<string> {
  const t = texto.trim();
  return NIT.test(t) ? { ok: true, valor: t } : { ok: false, codigo: "NIT_FORMATO" };
}

/** Encargo o cuenta: solo dígitos (se guardan tal cual, con sus ceros a la izquierda). */
export function leerDigitos(texto: string, codigo: string): ResultadoValor<string> {
  const t = texto.trim();
  return /^\d+$/.test(t) && t.length <= MAX_DIGITOS ? { ok: true, valor: t } : { ok: false, codigo };
}
