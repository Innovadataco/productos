/**
 * SPEC-184 (002-PI-079) + SPEC-185: repositorio de SimulacionAbusoRun.
 * Frontera DAL (Q-3): todo acceso pasa por aquí.
 * El modelo persiste config y resultados como JSON.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

export interface ConfigSimulacionAbuso {
    n: number;
    ipInyectada: string;
    identificador: string;
    plataforma: string;
    usuarioId?: string | undefined;
}

export interface ResultadoEnvioSimulacion {
    idx: number;
    ip: string;
    identificador: string;
    status: number;
    latenciaMs: number;
    estado?: string | undefined;
}

export interface ResultadosSimulacionAbuso {
    totalEnviados: number;
    totalBloqueados: number;
    totalSpam: number;
    latenciaPromedioMs: number;
    latenciaP50Ms: number;
    latenciaP95Ms: number;
    detalles: ResultadoEnvioSimulacion[];
}

export interface FiltrosListarSimulaciones {
    estado?: string | undefined;
    escenario?: string | undefined;
    page?: number;
    pageSize?: number;
}

export interface ListadoSimulaciones {
    items: Array<{
        id: string;
        escenario: string;
        totalReportes: number;
        progreso: number;
        estado: string;
        creadoPorId: string;
        creadoEn: Date;
        actualizadoEn: Date;
        resultadosJson: unknown;
        nota: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
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
        nota?: string | null | undefined;
    }) {
        return this.db.simulacionAbusoRun.create({
            data: {
                escenario: data.escenario,
                totalReportes: data.totalReportes,
                creadoPorId: data.creadoPorId,
                configJson: data.configJson as unknown as Prisma.InputJsonValue,
                ...(data.nota !== undefined ? { nota: data.nota } : {}),
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

    actualizarEstado(id: string, estado: string) {
        return this.db.simulacionAbusoRun.update({
            where: { id },
            data: { estado },
        });
    }

    async listar(filtros: FiltrosListarSimulaciones = {}): Promise<ListadoSimulaciones> {
        const page = Math.max(1, filtros.page ?? 1);
        const pageSize = Math.min(100, Math.max(1, filtros.pageSize ?? 25));
        const where: Prisma.SimulacionAbusoRunWhereInput = {};
        if (filtros.estado) {
            where.estado = filtros.estado;
        }
        if (filtros.escenario) {
            where.escenario = filtros.escenario;
        }

        const [items, total] = await Promise.all([
            this.db.simulacionAbusoRun.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                select: {
                    id: true,
                    escenario: true,
                    totalReportes: true,
                    progreso: true,
                    estado: true,
                    creadoPorId: true,
                    creadoEn: true,
                    actualizadoEn: true,
                    resultadosJson: true,
                    nota: true,
                },
            }),
            this.db.simulacionAbusoRun.count({ where }),
        ]);

        return { items, total, page, pageSize };
    }

    /**
     * Devuelve el conjunto de IPs que ya aparecen en configJson de corridas
     * existentes. Se usa para sugerir IPs frescas al operador.
     * Si se pasa `desde`, solo considera corridas creadas a partir de esa fecha
     * (p.ej. últimas 2 horas).
     */
    async buscarIpsUsadas(desde?: Date): Promise<Set<string>> {
        const rows = await this.db.$queryRaw<{ ip: string }[]>`
            SELECT DISTINCT "configJson"->>'ipInyectada' AS ip
            FROM "simulacion_abuso_runs"
            WHERE "configJson"->>'ipInyectada' IS NOT NULL
              AND (${desde}::timestamptz IS NULL OR "creadoEn" >= ${desde}::timestamptz)
        `;
        return new Set(rows.map((r) => r.ip));
    }
}
