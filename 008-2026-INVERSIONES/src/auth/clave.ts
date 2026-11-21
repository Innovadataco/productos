/**
 * Contraseñas (D-014): bcrypt de costo 12, igual que PI. Una clave mide de 12 a 72 bytes UTF-8.
 * `compararClave` corre bcrypt SIEMPRE, también sin hash (cuenta inexistente o sin clave) o con un
 * largo inválido: así el tiempo de respuesta no revela qué cuentas existen. Todo bcrypt corre bajo el
 * semáforo del proceso (src/auth/carga.ts): como máximo 2 a la vez.
 */
import bcrypt from "bcryptjs";
import { conBcrypt } from "./carga";
import { CLAVE_MAX_BYTES, CLAVE_MIN_BYTES, COSTO_BCRYPT } from "./limites";

/**
 * Hash señuelo de costo 12 de un texto aleatorio que nadie conoce. No es un secreto: es el comparando
 * cuando no hay hash real, y bcrypt contra él siempre da false.
 */
export const HASH_SENUELO = "$2b$12$sBgDyy.yx3rPi7FFSfSYe..C6bUy4pr.vgUM057QFYFbXFjl4UlM.";

export const bytesDeClave = (clave: string): number => new TextEncoder().encode(clave).length;

export function largoValido(clave: string): boolean {
  const bytes = bytesDeClave(clave);
  return bytes >= CLAVE_MIN_BYTES && bytes <= CLAVE_MAX_BYTES;
}

export async function hashClave(clave: string): Promise<string> {
  if (!largoValido(clave)) {
    throw new Error(`La contraseña debe tener entre ${CLAVE_MIN_BYTES} y ${CLAVE_MAX_BYTES} bytes.`);
  }
  return conBcrypt(() => bcrypt.hash(clave, COSTO_BCRYPT));
}

/** true solo si hay hash, el largo es válido y la clave coincide. Siempre corre un bcrypt. */
export async function compararClave(clave: string, hash: string | null): Promise<boolean> {
  const usable = hash !== null && largoValido(clave);
  const coincide = await conBcrypt(() => bcrypt.compare(clave, usable ? hash : HASH_SENUELO));
  return usable && coincide;
}
