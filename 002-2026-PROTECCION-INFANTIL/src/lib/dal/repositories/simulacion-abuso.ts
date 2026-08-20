/**
 * SPEC-184 (002-PI-079): repositorio de SimulacionAbusoRun.
 * Frontera DAL (Q-3): todo acceso pasa por aquí.
 * El modelo persiste config y resultados como JSON.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export interface ConfigSimulacionAbuso {
    n: number;
    ipInyectada: string;
    identificador: string;
    plataforma: string;
}

export interface ResultadosSimulacionAbuso {
    totalEnviados: number;
    totalBloqueados: number;
    totalSpam: number;
    latenciaPromedioMs: number;
}

export class SimulacionAbusoRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findById(id: string) {
        return this.db.simulacionAbusoRun.findUnique({ where: { id } });
    }

    findPendientesOEnProgreso() {
        return this.db.simulacionAbusoRun.findMany({
            where: { estado: { in: ["PENDIENTE", "EN_PROGRESO"] } },
            orderBy: { creadoEn: "asc" },
        });
    }

    crear(data: {
        escenario: string;
        totalReportes: number;
        creadoPorId: string;
        configJson: ConfigSimulacionAbuso;
    }) {
        return this.db.simulacionAbusoRun.create({
            data: {
                escenario: data.escenario,
                totalReportes: data.totalReportes,
                creadoPorId: data.creadoPorId,
                configJson: data.configJson as unknown as Prisma.InputJsonValue,
            },
        });
    }

    actualizarConfig(id: string, config: ConfigSimulacionAbuso) {
        return this.db.simulacionAbusoRun.update({
            where: { id },
            data: { configJson: config as unknown as Prisma.InputJsonValue },
        });
    }

    actualizarProgreso(id: string, progreso: number) {
        return this.db.simulacionAbusoRun.update({
            where: { id },
            data: { progreso },
        });
    }

    actualizarResultados(id: string, resultados: Partial<ResultadosSimulacionAbuso>) {
        return this.db.simulacionAbusoRun.update({
            where: { id },
            data: {
                resultadosJson: resultados as unknown as Prisma.InputJsonValue,
            },
        });
    }

    actualizarEstado(id: string, estado: string, fechaFin?: Date) {
        return this.db.simulacionAbusoRun.update({
            where: { id },
            data: { estado, ...(fechaFin ? { fechaFin } : {}) },
        });
    }
}
