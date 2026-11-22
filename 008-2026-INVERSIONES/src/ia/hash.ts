/**
 * JSON canónico y hash de los hechos. El hash identifica un paquete en el registro (`resumen_ia`): dos paquetes con
 * los mismos datos dan el mismo hash sin importar el orden de las claves, y cualquier cambio de un valor lo cambia.
 *
 * Forma canónica: objetos planos con las claves ordenadas por unidades UTF-16 (nunca `localeCompare`), recursiva;
 * las propiedades `undefined` se omiten; los arreglos van en su orden; sin espacios. Solo admite lo que un paquete
 * puede llevar: texto, booleanos, null y enteros seguros. Lo demás lanza TypeError (cierra en fallo).
 */
import { createHash } from "node:crypto";
import type { PaqueteHechos } from "./contrato";

const MAX_PROFUNDIDAD = 64;
export const PATRON_HASH = /^[0-9a-f]{64}$/;

/** sha256 en hexadecimal (minúsculas) del texto en UTF-8. */
export function sha256Hex(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

export function jsonCanonico(valor: unknown): string {
  return canonico(valor, 0, new WeakSet<object>());
}

function canonico(valor: unknown, profundidad: number, vistos: WeakSet<object>): string {
  if (valor === null || typeof valor === "boolean" || typeof valor === "string") return JSON.stringify(valor);
  if (typeof valor === "number") return numero(valor);
  if (typeof valor !== "object") throw new TypeError("Valor sin forma JSON canónica.");
  if (profundidad >= MAX_PROFUNDIDAD) throw new TypeError("Valor demasiado profundo para el JSON canónico.");
  if (vistos.has(valor)) throw new TypeError("Valor con ciclos: sin forma JSON canónica.");
  vistos.add(valor);
  const texto = Array.isArray(valor) ? arreglo(valor, profundidad, vistos) : objeto(valor, profundidad, vistos);
  vistos.delete(valor);
  return texto;
}

function numero(valor: number): string {
  if (!Number.isSafeInteger(valor) || Object.is(valor, -0)) throw new TypeError("Solo enteros seguros: los decimales van en texto.");
  return String(valor);
}

function arreglo(valor: readonly unknown[], profundidad: number, vistos: WeakSet<object>): string {
  const partes: string[] = [];
  for (let i = 0; i < valor.length; i += 1) {
    if (!Object.hasOwn(valor, i) || valor[i] === undefined) throw new TypeError("Arreglo con huecos o undefined.");
    partes.push(canonico(valor[i], profundidad + 1, vistos));
  }
  return `[${partes.join(",")}]`;
}

function objeto(valor: object, profundidad: number, vistos: WeakSet<object>): string {
  const prototipo = Object.getPrototypeOf(valor);
  if (prototipo !== Object.prototype && prototipo !== null) throw new TypeError("Solo objetos planos.");
  const registro = valor as Readonly<Record<string, unknown>>;
  const partes = Object.keys(registro)
    .sort()
    .filter((clave) => registro[clave] !== undefined)
    .map((clave) => `${JSON.stringify(clave)}:${canonico(registro[clave], profundidad + 1, vistos)}`);
  return `{${partes.join(",")}}`;
}

/** sha256 del JSON canónico del paquete sin su campo `hash` (solo el del primer nivel). */
export function hashPaquete(paquete: Omit<PaqueteHechos, "hash"> | PaqueteHechos): string {
  const { hash: _sinHash, ...resto } = paquete as PaqueteHechos;
  return sha256Hex(jsonCanonico(resto));
}

/** Copia profunda y congelada por el JSON canónico: lo que queda es exactamente lo que se serializó. */
export function clonCongelado<T>(valor: T): T {
  return congelar(JSON.parse(jsonCanonico(valor)) as unknown) as T;
}

function congelar(valor: unknown): unknown {
  if (typeof valor === "object" && valor !== null) {
    Object.values(valor).forEach(congelar);
    Object.freeze(valor);
  }
  return valor;
}
