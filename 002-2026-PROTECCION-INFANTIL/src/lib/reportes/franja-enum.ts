import type { FranjaHoraria } from "@prisma/client";
import type { FranjaAproximada } from "./franja-aproximada";

/**
 * SPEC-644 (I-379/I-388): la franja DECLARADA (dominio, minúscula — `FranjaAproximada`)
 * ↔ el enum PERSISTIDO en BD (`FranjaHoraria`, UPPER, convención Prisma del repo).
 *
 * Server-side a propósito: el cliente trabaja en `FranjaAproximada`; el enum es la
 * representación de persistencia. El mapeo es EXPLÍCITO (no `franja.toUpperCase()`) para
 * que el compilador exija las cuatro y un rename del enum rompa acá, no en silencio.
 */
export const FRANJA_A_ENUM: Record<FranjaAproximada, FranjaHoraria> = {
    madrugada: "MADRUGADA",
    manana: "MANANA",
    tarde: "TARDE",
    noche: "NOCHE",
};

/** Inverso: el enum persistido → la franja de dominio, para la LECTURA (la capa de
 *  display/análisis trabaja en `FranjaAproximada`). Explícito por el mismo motivo. */
export const ENUM_A_FRANJA: Record<FranjaHoraria, FranjaAproximada> = {
    MADRUGADA: "madrugada",
    MANANA: "manana",
    TARDE: "tarde",
    NOCHE: "noche",
};
