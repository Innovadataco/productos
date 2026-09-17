/**
 * SPEC-686 (I-420) · Repositorio de la ACEPTACIÓN de la autorización del profesional.
 * Registro inmutable (versión + hash del texto + fecha + IP + user-agent). Tabla APARTE
 * de `audit_consentimientos`: el profesional es prestador, no titular del dato.
 */
import type { AceptacionAutorizacionProfesional, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

export class AceptacionAutorizacionProfesionalRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    crear(data: {
        usuarioId: string;
        version: string;
        documentoHash: string;
        aceptadoEn: Date;
        ip: string;
        userAgent: string | null;
    }): Promise<AceptacionAutorizacionProfesional> {
        return this.db.aceptacionAutorizacionProfesional.create({ data });
    }

    /** La última aceptación del profesional (la vigente), o null si nunca aceptó. */
    buscarUltima(usuarioId: string): Promise<AceptacionAutorizacionProfesional | null> {
        return this.db.aceptacionAutorizacionProfesional.findFirst({
            where: { usuarioId },
            orderBy: { aceptadoEn: "desc" },
        });
    }

    /**
     * SPEC-686 · la ANTERIORIDAD: la última aceptación cuya fecha es <= `fecha`. Es lo que
     * prueba que la autorización fue PREVIA a la consulta de antecedentes (Ley 1918/Decreto
     * 753). Devuelve null si el profesional no había aceptado nada antes de esa fecha.
     */
    buscarUltimaAntesDe(usuarioId: string, fecha: Date): Promise<AceptacionAutorizacionProfesional | null> {
        return this.db.aceptacionAutorizacionProfesional.findFirst({
            where: { usuarioId, aceptadoEn: { lte: fecha } },
            orderBy: { aceptadoEn: "desc" },
        });
    }
}
