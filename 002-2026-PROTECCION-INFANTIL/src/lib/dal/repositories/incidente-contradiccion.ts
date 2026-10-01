/**
 * SPEC-787 · DAL de los incidentes de contradicción de encuestas (la bandeja del verificador).
 * Lectura de los incidentes de SPEC-753 + las dos encuestas de la cita para la vista SIMÉTRICA.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

const SELECT_ENCUESTA = {
    origen: true,
    seRealizo: true,
    operador: true,
    inicio: true,
    enlace: true,
    duracion: true,
    respondidaEn: true,
} as const;

const SELECT_INCIDENTE = {
    id: true,
    solicitudId: true,
    pregunta: true,
    padreValor: true,
    profesionalValor: true,
    reclamadoEn: true,
    venceEn: true,
    resueltoEn: true,
    resueltoPor: true,
    solicitud: { select: { encuestasSesion: { select: SELECT_ENCUESTA } } },
} as const;

export class IncidenteContradiccionRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Incidentes ABIERTOS (sin resolver), ordenados por el VENCIMIENTO real (`venceEn`), no por
     * creación — un incidente legal creado después puede vencer antes. Trae las dos encuestas.
     */
    listarAbiertos() {
        return this.db.incidenteContradiccionEncuesta.findMany({
            where: { resueltoEn: null },
            orderBy: { venceEn: "asc" },
            select: SELECT_INCIDENTE,
        });
    }

    findPorId(id: string) {
        return this.db.incidenteContradiccionEncuesta.findUnique({ where: { id }, select: SELECT_INCIDENTE });
    }

    /** Registra el desenlace. `resueltoPor` = snapshot del verificador (String, NO FK: sobrevive a la baja). */
    resolver(id: string, verificadorId: string, resueltoEn: Date) {
        return this.db.incidenteContradiccionEncuesta.update({
            where: { id },
            data: { resueltoEn, resueltoPor: verificadorId },
        });
    }
}
