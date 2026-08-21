import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { NivelLog, Prisma } from "@prisma/client";

const NIVELES_ORDEN: Record<NivelLog, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

const TODOS_LOS_NIVELES: readonly NivelLog[] = ["DEBUG", "INFO", "WARN", "ERROR"];

export type ListarLogsInput = {
    servicio?: string;
    nivel?: NivelLog;
    desde?: Date;
    hasta?: Date;
    q?: string;
    limit?: number;
    offset?: number;
};

export type PurgarLogsInput = {
    hasta: Date;
    servicio?: string;
    nivel?: NivelLog;
    motivo: string;
    ejecutadoPorId: string;
};

function nivelesDesde(nivel: NivelLog): NivelLog[] {
    return TODOS_LOS_NIVELES.filter((n) => NIVELES_ORDEN[n] >= NIVELES_ORDEN[nivel]);
}

function construirWhere(
    input: {
        servicio?: string | undefined;
        nivel?: NivelLog | undefined;
        desde?: Date | undefined;
        hasta?: Date | undefined;
        q?: string | undefined;
    }
): Prisma.WorkerLogWhereInput {
    const where: Prisma.WorkerLogWhereInput = {};

    if (input.servicio) {
        where.servicio = input.servicio;
    }
    if (input.nivel) {
        where.nivel = { in: nivelesDesde(input.nivel) };
    }
    if (input.desde || input.hasta) {
        where.creadoEn = {};
        if (input.desde) where.creadoEn.gte = input.desde;
        if (input.hasta) where.creadoEn.lte = input.hasta;
    }
    if (input.q) {
        where.mensaje = { contains: input.q, mode: "insensitive" };
    }

    return where;
}

function validarRangoFechas(desde?: Date, hasta?: Date): void {
    if (desde && hasta && desde > hasta) {
        throw new AppError("La fecha 'desde' no puede ser posterior a 'hasta'", ERROR_CODES.VALIDATION_ERROR, 400);
    }
}

function validarPaginacion(limit: number, offset: number): void {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
        throw new AppError("limit debe estar entre 1 y 500", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (!Number.isInteger(offset) || offset < 0) {
        throw new AppError("offset debe ser mayor o igual a 0", ERROR_CODES.VALIDATION_ERROR, 400);
    }
}

function inicioDelDiaUtc(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function validarPuedaPurgar(hasta: Date): void {
    const hoy = inicioDelDiaUtc(new Date());
    if (hasta >= hoy) {
        throw new AppError("La purga solo permite fechas anteriores al día actual", ERROR_CODES.VALIDATION_ERROR, 400);
    }
}

function validarMotivo(motivo: string): void {
    if (motivo.length < 20 || motivo.length > 500) {
        throw new AppError("El motivo debe tener entre 20 y 500 caracteres", ERROR_CODES.VALIDATION_ERROR, 400);
    }
}

export async function listarLogs(input: ListarLogsInput): Promise<{ items: unknown[]; total: number }> {
    const limit = input.limit ?? 100;
    const offset = input.offset ?? 0;

    validarPaginacion(limit, offset);
    validarRangoFechas(input.desde, input.hasta);

    const where = construirWhere(input);
    const [items, total] = await prisma.$transaction([
        prisma.workerLog.findMany({
            where,
            orderBy: { creadoEn: "desc" },
            take: limit,
            skip: offset,
        }),
        prisma.workerLog.count({ where }),
    ]);

    return { items, total };
}

export async function contarLogsParaPurgar(input: {
    hasta: Date;
    servicio?: string;
    nivel?: NivelLog;
}): Promise<number> {
    const where = construirWhere({ servicio: input.servicio, nivel: input.nivel, hasta: input.hasta });
    return prisma.workerLog.count({ where });
}

export async function purgarLogs(input: PurgarLogsInput): Promise<{ filasBorradas: number }> {
    validarPuedaPurgar(input.hasta);
    validarMotivo(input.motivo);

    const where = construirWhere({ servicio: input.servicio, nivel: input.nivel, hasta: input.hasta });
    const filtros = {
        hasta: input.hasta.toISOString(),
        servicio: input.servicio,
        nivel: input.nivel,
    };

    const filasBorradas = await prisma.$transaction(async (tx) => {
        const resultado = await tx.workerLog.deleteMany({ where });
        await logAudit({
            accion: "LOGS_MANTENIMIENTO_PURGA",
            tipoRecurso: "WorkerLog",
            usuarioId: input.ejecutadoPorId,
            valorAnterior: JSON.stringify(filtros),
            valorNuevo: JSON.stringify({ ...filtros, filasBorradas: resultado.count }),
            ipAddress: "unknown",
            userAgent: "unknown",
            metadatos: {
                motivo: input.motivo,
                ...filtros,
                filasBorradas: resultado.count,
            },
            tx,
        });
        return resultado.count;
    });

    return { filasBorradas };
}
