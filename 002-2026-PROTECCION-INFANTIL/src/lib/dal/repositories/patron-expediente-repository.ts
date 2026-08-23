/**
 * SPEC-234 (002-PI-134): repositorio de PatronExpediente.
 * Frontera DAL (Q-3): todo acceso a estas entidades pasa por aquí.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export type SeveridadPatron = "BAJA" | "MEDIA" | "ALTA";

export interface PatronExpedienteInput {
    tipoPatron: string;
    severidad: SeveridadPatron;
    nivelConfianza: number;
    descripcionTexto: string;
    datosContextoJson: Prisma.InputJsonValue;
    detectadoEn: Date;
}

export class PatronExpedienteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    async guardarPatrones(expedienteId: string, patrones: PatronExpedienteInput[]) {
        if (patrones.length === 0) return [];
        const data = patrones.map((p) => ({
            expedienteId,
            tipoPatron: p.tipoPatron as never,
            severidad: p.severidad,
            nivelConfianza: p.nivelConfianza,
            descripcionTexto: p.descripcionTexto,
            datosContextoJson: p.datosContextoJson,
            detectadoEn: p.detectadoEn,
        }));
        await this.db.patronExpediente.createMany({ data });
        return this.listarPorExpediente(expedienteId);
    }

    listarPorExpediente(expedienteId: string) {
        return this.db.patronExpediente.findMany({
            where: { expedienteId },
            orderBy: { createdAt: "desc" },
        });
    }

    eliminarPorExpediente(expedienteId: string) {
        return this.db.patronExpediente.deleteMany({ where: { expedienteId } });
    }
}
