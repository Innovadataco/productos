/**
 * SPEC-234 (002-PI-134): repositorio de SenalComunitariaCache.
 * Frontera DAL (Q-3): todo acceso a esta entidad pasa por aquí.
 * Acepta un cliente transaccional opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export interface SenalComunitariaCacheInput {
    identificadorReportado: string;
    totalExpedientesActivos?: number;
    totalExpedientesCerrados?: number;
    totalExpedientesEscalados?: number;
    categoriasFrecuenciaJson: Prisma.InputJsonValue;
    primeraAparicionEn: Date;
    ultimaAparicionEn: Date;
    paisesJson: Prisma.InputJsonValue;
    ciudadesJson: Prisma.InputJsonValue;
    plataformasJson: Prisma.InputJsonValue;
    invalidado?: boolean;
}

export class SenalComunitariaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    obtenerPorIdentificador(identificadorReportado: string) {
        return this.db.senalComunitariaCache.findUnique({ where: { identificadorReportado } });
    }

    guardarCache(data: SenalComunitariaCacheInput) {
        const ahora = new Date();
        return this.db.senalComunitariaCache.upsert({
            where: { identificadorReportado: data.identificadorReportado },
            update: {
                totalExpedientesActivos: data.totalExpedientesActivos ?? 0,
                totalExpedientesCerrados: data.totalExpedientesCerrados ?? 0,
                totalExpedientesEscalados: data.totalExpedientesEscalados ?? 0,
                categoriasFrecuenciaJson: data.categoriasFrecuenciaJson,
                primeraAparicionEn: data.primeraAparicionEn,
                ultimaAparicionEn: data.ultimaAparicionEn,
                paisesJson: data.paisesJson,
                ciudadesJson: data.ciudadesJson,
                plataformasJson: data.plataformasJson,
                invalidado: data.invalidado ?? false,
                actualizadoEn: ahora,
            },
            create: {
                identificadorReportado: data.identificadorReportado,
                totalExpedientesActivos: data.totalExpedientesActivos ?? 0,
                totalExpedientesCerrados: data.totalExpedientesCerrados ?? 0,
                totalExpedientesEscalados: data.totalExpedientesEscalados ?? 0,
                categoriasFrecuenciaJson: data.categoriasFrecuenciaJson,
                primeraAparicionEn: data.primeraAparicionEn,
                ultimaAparicionEn: data.ultimaAparicionEn,
                paisesJson: data.paisesJson,
                ciudadesJson: data.ciudadesJson,
                plataformasJson: data.plataformasJson,
                invalidado: data.invalidado ?? false,
                actualizadoEn: ahora,
            },
        });
    }

    async invalidar(identificadorReportado: string) {
        const existe = await this.obtenerPorIdentificador(identificadorReportado);
        if (!existe) return null;
        return this.db.senalComunitariaCache.update({
            where: { identificadorReportado },
            data: { invalidado: true, actualizadoEn: new Date() },
        });
    }

    obtenerPendientesDeRefresco(refreshMin: number, limite = 100) {
        return this.db.$queryRaw<
            { identificadorReportado: string }[]
        >`
            SELECT "identificadorReportado"
            FROM "senal_comunitaria_cache"
            WHERE "invalidado" = true
               OR "actualizadoEn" < NOW() - INTERVAL '1 minute' * ${refreshMin}
            ORDER BY "actualizadoEn" ASC
            LIMIT ${limite}
        `;
    }
}
