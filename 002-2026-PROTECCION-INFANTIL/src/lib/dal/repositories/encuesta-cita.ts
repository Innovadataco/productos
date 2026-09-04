/**
 * SPEC-429 (A-75 · brief §9-bis) · Repositorio de `EncuestaCita` e
 * `IncidenteContradiccionEncuesta`. Q-3: la lógica del `encuestas.service`
 * usa esta clase; el service no toca Prisma directo.
 */
import type { OrigenEncuestaCita, Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

export class EncuestaCitaRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = (tx ?? prisma) as DbClient;
    }

    listarPorSolicitud(solicitudId: string) {
        return this.db.encuestaCita.findMany({ where: { solicitudId } });
    }

    crear(input: {
        solicitudId: string;
        origen: OrigenEncuestaCita;
        r1: string;
        r2: string;
        r3: string;
        r4: string;
        r5: string;
    }) {
        return this.db.encuestaCita.create({
            data: input,
            select: { id: true },
        });
    }

    /** Cuenta CUMPLIDA sin encuesta del rol PADRE para ese usuario. */
    contarPendientesPadre(usuarioId: string) {
        return this.db.solicitudCita.count({
            where: {
                padreUsuarioId: usuarioId,
                estado: "CUMPLIDA",
                encuestas: { none: { origen: "PADRE" } },
            },
        });
    }

    /** Cuenta CUMPLIDA sin encuesta del rol PROFESIONAL para ese usuario. */
    contarPendientesProfesional(usuarioId: string) {
        return this.db.solicitudCita.count({
            where: {
                profesional: { usuarioId },
                estado: "CUMPLIDA",
                encuestas: { none: { origen: "PROFESIONAL" } },
            },
        });
    }

    proximaPendientePadre(usuarioId: string) {
        return this.db.solicitudCita.findFirst({
            where: {
                padreUsuarioId: usuarioId,
                estado: "CUMPLIDA",
                encuestas: { none: { origen: "PADRE" } },
            },
            select: { id: true, actualizadoEn: true },
            orderBy: { actualizadoEn: "asc" },
        });
    }

    proximaPendienteProfesional(usuarioId: string) {
        return this.db.solicitudCita.findFirst({
            where: {
                profesional: { usuarioId },
                estado: "CUMPLIDA",
                encuestas: { none: { origen: "PROFESIONAL" } },
            },
            select: { id: true, actualizadoEn: true },
            orderBy: { actualizadoEn: "asc" },
        });
    }

    /** Actor + par de usuarios (padre + profesional) de una solicitud. */
    resolverPartes(solicitudId: string) {
        return this.db.solicitudCita.findUnique({
            where: { id: solicitudId },
            select: {
                id: true,
                estado: true,
                padreUsuarioId: true,
                profesional: { select: { usuarioId: true } },
            },
        });
    }

    marcarEncuestaPendiente(userIds: string[], valor: boolean) {
        return this.db.usuario.updateMany({
            where: { id: { in: userIds } },
            data: { encuestaPendiente: valor },
        });
    }

    setEncuestaPendienteUsuario(usuarioId: string, valor: boolean) {
        return this.db.usuario.update({
            where: { id: usuarioId },
            data: { encuestaPendiente: valor },
        });
    }
}

export class IncidenteContradiccionEncuestaRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = (tx ?? prisma) as DbClient;
    }

    crear(input: {
        solicitudId: string;
        pregunta: string;
        padreValor: string;
        profesionalValor: string;
    }) {
        return this.db.incidenteContradiccionEncuesta.create({
            data: input,
            select: { id: true },
        });
    }

    listarPorSolicitud(solicitudId: string) {
        return this.db.incidenteContradiccionEncuesta.findMany({
            where: { solicitudId },
        });
    }
}
