/**
 * TOTP del dueño (RFC 6238 sobre HOTP de RFC 4226), con node:crypto y sin dependencias:
 * HMAC-SHA1, pasos de 30 s, 6 dígitos y ventana de ±1 paso (lo que usan las apps comunes).
 * - `verificarTotp` compara SIEMPRE los 3 candidatos con `timingSafeEqual` y devuelve el paso mayor que
 *   coincide; un paso menor o igual al último usado es REPETIDO (antireplay).
 * - Base32 de RFC 4648 para mostrar el secreto y para el `otpauth://` (y, con el alfabeto de Crockford,
 *   para los códigos de recuperación: src/auth/recuperacion.ts).
 * - `normalizarCodigoTotp` admite los espacios con que las apps muestran el código («123 456»).
 * Módulo puro: no lee la base ni el entorno. Probado con los vectores de los dos RFC.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { TOTP_DIGITOS, TOTP_PERIODO_S, TOTP_SECRETO_BYTES, TOTP_VENTANA } from "./limites";

/** Alfabeto de RFC 4648 (el del `otpauth://`). */
export const ALFABETO_RFC4648 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
/** Alfabeto de Crockford: sin I, L, O ni U, para que no se confundan al copiar a mano. */
export const ALFABETO_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ALFABETO = ALFABETO_RFC4648;
const BITS_POR_CARACTER = 5;
const BLOQUE = 8;
const EMISOR = "Inversiones";
const FORMA_CODIGO = /^[0-9]{6}$/;
/** Un código con espacios no pasa de esto (6 dígitos y unos pocos espacios). */
const ENTRADA_MAX = 16;
/** Base32 canónico en mayúsculas, con o sin relleno. */
const FORMA_BASE32 = /^[A-Z2-7]*=*$/;
/** Largos válidos del último bloque sin relleno (RFC 4648 §6): 0, 2, 4, 5 o 7 caracteres. */
const RESTOS_VALIDOS: ReadonlySet<number> = new Set([0, 2, 4, 5, 7]);

/** Quita el relleno final («=») de un base32. */
export const sinRelleno = (texto: string): string => texto.replace(/=+$/, "");

/**
 * Base32 de RFC 4648 (con relleno). Con otro `alfabeto` de 32 caracteres sirve igual; el relleno solo
 * aparece si los bytes no caben justos (10 bytes son 16 caracteres exactos).
 */
export function codificarBase32(bytes: Uint8Array, alfabeto: string = ALFABETO): string {
  let bits = 0;
  let valor = 0;
  let salida = "";
  for (const byte of bytes) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= BITS_POR_CARACTER) {
      salida += alfabeto[(valor >>> (bits - BITS_POR_CARACTER)) & 31];
      bits -= BITS_POR_CARACTER;
    }
    valor &= (1 << bits) - 1;
  }
  if (bits > 0) salida += alfabeto[(valor << (BITS_POR_CARACTER - bits)) & 31];
  const resto = salida.length % BLOQUE;
  return resto === 0 ? salida : salida + "=".repeat(BLOQUE - resto);
}

/** Los bytes de un base32 canónico (con relleno correcto o sin relleno); si no, null. */
export function decodificarBase32(texto: string): Buffer | null {
  if (!FORMA_BASE32.test(texto)) return null;
  const limpio = sinRelleno(texto);
  if (texto.length !== limpio.length && texto.length % BLOQUE !== 0) return null;
  if (!RESTOS_VALIDOS.has(limpio.length % BLOQUE)) return null;
  const bytes: number[] = [];
  let bits = 0;
  let valor = 0;
  for (const caracter of limpio) {
    valor = (valor << BITS_POR_CARACTER) | ALFABETO.indexOf(caracter);
    bits += BITS_POR_CARACTER;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
    valor &= (1 << bits) - 1;
  }
  const resultado = Buffer.from(bytes);
  // Canónico: los bits sobrantes en cero y el mismo relleno que daría la codificación.
  const canonico = codificarBase32(resultado);
  return canonico === texto || sinRelleno(canonico) === texto ? resultado : null;
}

/** HOTP (RFC 4226 §5.3): HMAC-SHA1 del contador en 8 bytes big-endian y truncado dinámico. */
export function hotp(secreto: Uint8Array, contador: number, digitos: number = TOTP_DIGITOS): string {
  const mensaje = Buffer.alloc(8);
  mensaje.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac("sha1", secreto).update(mensaje).digest();
  const desplazamiento = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binario = hmac.readUInt32BE(desplazamiento) & 0x7fffffff;
  return String(binario % 10 ** digitos).padStart(digitos, "0");
}

/** El paso de tiempo (RFC 6238 §4): segundos Unix / 30, entero. */
export const pasoDe = (ms: number): number => Math.floor(ms / 1000 / TOTP_PERIODO_S);

export const formaDeCodigoTotp = (codigo: string): boolean => FORMA_CODIGO.test(codigo);

/** Los 6 dígitos del código, sin los espacios con que lo muestran las apps; null si no es un código TOTP. */
export function normalizarCodigoTotp(texto: string): string | null {
  if (texto.length > ENTRADA_MAX) return null;
  const limpio = texto.replace(/\s+/g, "");
  return formaDeCodigoTotp(limpio) ? limpio : null;
}

export type VerificacionTotp =
  | { readonly ok: true; readonly paso: number }
  | { readonly ok: false; readonly motivo: "INCORRECTO" | "REPETIDO" };

const iguales = (a: string, b: string): boolean => timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));

/**
 * El código contra los pasos actual−1, actual y actual+1. Se calculan y comparan los 3 siempre (el tiempo
 * no depende de cuál coincide). Gana el paso mayor; si solo coinciden pasos ≤ `ultimoPaso`, es REPETIDO.
 */
export function verificarTotp(secreto: Uint8Array, codigo: string, ahoraMs: number, ultimoPaso: number | null): VerificacionTotp {
  if (!formaDeCodigoTotp(codigo)) return { ok: false, motivo: "INCORRECTO" };
  const actual = pasoDe(ahoraMs);
  const coinciden: number[] = [];
  for (let d = -TOTP_VENTANA; d <= TOTP_VENTANA; d += 1) {
    const paso = actual + d;
    if (paso >= 0 && iguales(hotp(secreto, paso), codigo)) coinciden.push(paso);
  }
  if (coinciden.length === 0) return { ok: false, motivo: "INCORRECTO" };
  const mayor = Math.max(...coinciden);
  return ultimoPaso !== null && mayor <= ultimoPaso ? { ok: false, motivo: "REPETIDO" } : { ok: true, paso: mayor };
}

/** Secreto nuevo de 160 bits, generado en el servidor. */
export const generarSecretoTotp = (): Buffer => randomBytes(TOTP_SECRETO_BYTES);

/** `otpauth://totp/Inversiones:<cuenta>?secret=…` (Key Uri Format), con el base32 sin relleno. */
export function uriOtpauth(secreto: Uint8Array, cuenta: string): string {
  const parametros = [
    `secret=${sinRelleno(codificarBase32(secreto))}`,
    `issuer=${encodeURIComponent(EMISOR)}`,
    "algorithm=SHA1",
    `digits=${TOTP_DIGITOS}`,
    `period=${TOTP_PERIODO_S}`,
  ];
  return `otpauth://totp/${encodeURIComponent(EMISOR)}:${encodeURIComponent(cuenta)}?${parametros.join("&")}`;
}
