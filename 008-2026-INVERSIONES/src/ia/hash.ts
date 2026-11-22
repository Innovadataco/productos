/** Esqueleto (rojo). */
import type { PaqueteHechos } from "./contrato";
export const PATRON_HASH = /^[0-9a-f]{64}$/;
export function sha256Hex(_texto: string): string { throw new Error("SIN_IMPLEMENTAR"); }
export function jsonCanonico(_valor: unknown): string { throw new Error("SIN_IMPLEMENTAR"); }
export function hashPaquete(_paquete: Omit<PaqueteHechos, "hash"> | PaqueteHechos): string { throw new Error("SIN_IMPLEMENTAR"); }
export function clonCongelado<T>(_valor: T): T { throw new Error("SIN_IMPLEMENTAR"); }
