/**
 * SPEC-824 · DAL de lectura de la Puerta de Soporte para la BANDEJA del operador/admin.
 *
 * La creación vive en el servicio (`dal/services/soporte/peticion-servicio.service.ts`). Acá SOLO la lectura
 * de la bandeja: peticiones ABIERTAS (sin resolver) con lo mínimo para triar por vencimiento.
 *
 * 🔒 PRIVACIDAD (candado de 824): el SELECT es METADATA pura — motivo, relojes, y del caso legal SOLO el
 * `tipo` (la ACCIÓN: ver/corregir/pedir borrar) y sus fechas. NO trae `sujetoDelDato` (de quién), NI la
 * identidad del peticionario, NI nada del contenido. La `SolicitudHabeasData` está despojada a propósito
 * (enums, sin narrativa) para sobrevivir a una supresión; leer la bandeja no puede revelar qué se pidió borrar.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

/** METADATA pura — ver nota de privacidad en la cabecera. */
const SELECT_BANDEJA = {
    id: true,
    motivo: true,
    creadoEn: true,
    venceEn: true, // término INTERNO de la PQR
    resueltoEn: true,
    // Del caso legal: el reloj LEGAL (la bandeja DERIVA por el enlace, no copia) + el tipo de acción.
    // NO se trae sujetoDelDato ni calidad: eso es «de quién», no hace falta para triar por vencimiento.
    solicitudHabeasData: { select: { tipo: true, venceEn: true, resueltaEn: true } },
} as const;

export type FilaBandejaPeticion = Prisma.PeticionServicioGetPayload<{ select: typeof SELECT_BANDEJA }>;

export class PeticionServicioRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Peticiones ABIERTAS (sin resolver). El orden FINAL por vencimiento EFECTIVO lo pone el servicio: para
     * una habeas data el vencimiento real es el del caso legal enlazado (no el término interno de la PQR), y
     * eso no es expresable como un `orderBy` declarativo cruzando la relación.
     */
    listarAbiertas(): Promise<FilaBandejaPeticion[]> {
        return this.db.peticionServicio.findMany({
            where: { resueltoEn: null },
            select: SELECT_BANDEJA,
        });
    }
}
