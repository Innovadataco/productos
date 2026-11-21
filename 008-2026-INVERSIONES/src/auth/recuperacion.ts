/**
 * Códigos de recuperación del TOTP: 10 por generación, de 80 bits cada uno (10 bytes aleatorios en 16
 * caracteres base32 de Crockford, en grupos de 4). Se muestran UNA vez y en la base va solo su sha256:
 * con 80 bits de entropía, recorrerlos todos contra un sha256 filtrado es inviable, así que no hace falta
 * un hash lento ni una pimienta (que los ataría a AUTH_SECRET). Al escribirlos a mano se perdonan
 * minúsculas, guiones, espacios e I/L/O (se leen 1, 1 y 0). Módulo puro.
 */
import { createHash, randomBytes } from "node:crypto";
import { CODIGOS_RECUPERACION, CODIGO_RECUPERACION_BYTES } from "./limites";
import { ALFABETO_CROCKFORD, codificarBase32 } from "./totp";

const ALFABETO = ALFABETO_CROCKFORD;
const LARGO = (CODIGO_RECUPERACION_BYTES * 8) / 5;
const GRUPO = 4;
/** Un texto más largo que esto ni se mira (los guiones y espacios de un código no llegan a tanto). */
const ENTRADA_MAX = 64;
const FORMA = new RegExp(`^[${ALFABETO}]{${LARGO}}$`);

/** 10 bytes → 16 caracteres de Crockford: 80 bits caben exactos en 16 grupos de 5 (sin relleno). */
const aCrockford = (bytes: Uint8Array): string => codificarBase32(bytes, ALFABETO);

const conGuiones = (codigo: string): string => (codigo.match(new RegExp(`.{${GRUPO}}`, "g")) ?? []).join("-");

/** 10 códigos nuevos, distintos entre sí, en la forma XXXX-XXXX-XXXX-XXXX. */
export function generarCodigosRecuperacion(): readonly string[] {
  const codigos = new Set<string>();
  while (codigos.size < CODIGOS_RECUPERACION) codigos.add(aCrockford(randomBytes(CODIGO_RECUPERACION_BYTES)));
  return [...codigos].map(conGuiones);
}

/** El código en su forma canónica (16 caracteres de Crockford en mayúsculas), o null si no lo es. */
export function normalizarCodigoRecuperacion(texto: string): string | null {
  if (texto.length > ENTRADA_MAX) return null;
  const limpio = texto.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
  return FORMA.test(limpio) ? limpio : null;
}

/** sha256 hexadecimal del código ya normalizado: lo único que se guarda. */
export const hashCodigoRecuperacion = (normalizado: string): string => createHash("sha256").update(normalizado, "utf8").digest("hex");
