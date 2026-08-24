/**
 * SPEC-215 (002-PI-115): generador puro de códigos de referido.
 *
 * Formato: `PI-<TIPO>-<HASH8>` donde `<TIPO>` es `COLEGIO` o `PADRE` y
 * `<HASH8>` es alfanumérico en mayúsculas SIN los caracteres ambiguos
 * `O`, `0`, `I`, `1` (FR-002). La unicidad contra la base de datos la
 * garantiza `referido.service.ts` (reintento con nuevo hash, FR-003).
 */
import { randomInt } from "node:crypto";
import type { TipoTitular } from "@prisma/client";

/** Alfabeto sin caracteres ambiguos (O/0/I/1): 32 símbolos. */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LONGITUD_HASH = 8;

const PATRON_CODIGO = /^PI-(COLEGIO|PADRE)-[A-HJ-NP-Z2-9]{8}$/;

/** Hash aleatorio de 8 caracteres sin O/0/I/1 (criptográficamente uniforme). */
export function generarHashReferido(): string {
    let hash = "";
    for (let i = 0; i < LONGITUD_HASH; i++) {
        hash += ALFABETO[randomInt(ALFABETO.length)];
    }
    return hash;
}

/** Código completo `PI-<TIPO>-<HASH8>` para un tipo de titular. */
export function generarCodigoReferido(tipoTitular: TipoTitular): string {
    return `PI-${tipoTitular}-${generarHashReferido()}`;
}

/** Valida el formato de un código de referido (sin tocar la base de datos). */
export function esFormatoCodigoReferidoValido(codigo: string): boolean {
    return PATRON_CODIGO.test(codigo.trim().toUpperCase());
}
