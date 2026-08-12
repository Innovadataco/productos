/**
 * SPEC-166: consulta de bandeja "nivel dios" para AlertaColegio.
 * Encapsula listado filtrado/ordenado, asignación y recálculo de prioridad.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { DbClient } from "../unit-of-work";
import type { EstadoAlertaColegio, TipoSujeto } from "./alerta-colegio";
import { ORDEN_ESTADO, type PrioridadAlerta } from "@/lib/colegio/alertas-prioridad";

export type FiltrosBandeja = {
    estado?: EstadoAlertaColegio;
    tipoSujeto?: TipoSujeto;
    cursoId?: string;
    categoria?: string;
    gravedad?: PrioridadAlerta;
    desde?: Date;
    hasta?: Date;
};

export type Paginacion = { page: number; pageSize: number };

const INCLUDE_BANDEJA = {
    identificadorEstudiante: {
        select: {
            valor: true,
            etiquetaRelacion: true,
            estudiante: { select: { nombre: true, apellidos: true, cursoId: true, curso: { select: { nombre: true, grado: true } } } },
        },
    },
    identificadorProfesor: { select: { profesor: { select: { nombre: true, apellidos: true } } } },
    identificadorAcudiente: { select: { acudiente: { select: { nombre: true, relacion: true } } } },
    asignadoA: { select: { id: true, nombre: true, email: true } },
    reporte: {
        select: {
            estado: true,
            creadoEn: true,
            clasificacion: { select: { categoria: true, confianza: true, posibleAgresorPar: true } },
        },
    },
} satisfies Prisma.AlertaColegioInclude;

export type AlertaBandejaRow = Prisma.AlertaColegioGetPayload<{ include: typeof INCLUDE_BANDEJA }>;

const PRIORIDAD_ORDEN: Record<PrioridadAlerta, number> = { alta: 0, media: 1, baja: 2 };

function scoreOrden(alerta: AlertaBandejaRow): number {
    const prioridad = PRIORIDAD_ORDEN[(alerta.prioridad as PrioridadAlerta) ?? "baja"] ?? 2;
    const estado = ORDEN_ESTADO[alerta.estado] ?? 9;
    const sla = alerta.vencimientoSla?.getTime() ?? Number.MAX_SAFE_INTEGER;
    // Prioridad (más alto = más importante) primero, luego estado, luego SLA más próximo.
    return prioridad * 1e18 + estado * 1e12 + sla;
}

export class AlertaColegioBandejaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Bandeja filtrada, ordenada por prioridad + novedad + SLA y paginada. */
    async listarBandeja(colegioId: string, filtros: FiltrosBandeja, paginacion: Paginacion = { page: 1, pageSize: 25 }) {
        if (filtros.cursoId && filtros.tipoSujeto && filtros.tipoSujeto !== "ESTUDIANTE") {
            return { items: [] as AlertaBandejaRow[], total: 0, page: paginacion.page, pageSize: paginacion.pageSize };
        }

        const where: Prisma.AlertaColegioWhereInput = {
            colegioId,
            reporte: { eliminado: false },
            ...(filtros.estado ? { estado: filtros.estado } : {}),
            ...(filtros.tipoSujeto ? { tipoSujeto: filtros.tipoSujeto } : {}),
            ...(filtros.gravedad ? { prioridad: filtros.gravedad } : {}),
            ...(filtros.desde || filtros.hasta
                ? {
                    creadoEn: {
                        ...(filtros.desde ? { gte: filtros.desde } : {}),
                        ...(filtros.hasta ? { lte: filtros.hasta } : {}),
                    },
                }
                : {}),
            ...(filtros.categoria ? { reporte: { clasificacion: { categoria: filtros.categoria as never } } } : {}),
            ...(filtros.cursoId && filtros.tipoSujeto !== "PROFESOR" && filtros.tipoSujeto !== "ACUDIENTE"
                ? { identificadorEstudiante: { estudiante: { cursoId: filtros.cursoId } } }
                : {}),
        };

        const [total, filas] = await Promise.all([
            this.db.alertaColegio.count({ where }),
            this.db.alertaColegio.findMany({ where, include: INCLUDE_BANDEJA }),
        ]);

        const ordenadas = filas.sort((a, b) => scoreOrden(a) - scoreOrden(b));
        const pageSize = Math.min(Math.max(paginacion.pageSize, 1), 100);
        const page = Math.max(paginacion.page, 1);
        const offset = (page - 1) * pageSize;
        const items = ordenadas.slice(offset, offset + pageSize);
        return { items, total, page, pageSize };
    }

    /** Asigna una alerta a un usuario; 404 si es ajena. */
    async asignar(colegioId: string, id: string, asignadoAId: string | null) {
        const { count } = await this.db.alertaColegio.updateMany({
            where: { id, colegioId },
            data: { asignadoAId },
        });
        if (count === 0) throw new AppError("Alerta no encontrada", ERROR_CODES.NOT_FOUND, 404);
        return this.db.alertaColegio.findUniqueOrThrow({ where: { id } });
    }

    /** Recalcula prioridad y SLA de una alerta (tenant-first). */
    async recalcularPrioridad(colegioId: string, id: string, prioridad: PrioridadAlerta, vencimientoSla: Date) {
        const { count } = await this.db.alertaColegio.updateMany({
            where: { id, colegioId },
            data: { prioridad, vencimientoSla },
        });
        if (count === 0) throw new AppError("Alerta no encontrada", ERROR_CODES.NOT_FOUND, 404);
        return this.db.alertaColegio.findUniqueOrThrow({ where: { id } });
    }

    /** Alertas por IDs filtradas por colegio (para acciones en lote). */
    listarPorIds(colegioId: string, ids: string[]) {
        if (ids.length === 0) return Promise.resolve([] as AlertaBandejaRow[]);
        return this.db.alertaColegio.findMany({
            where: { id: { in: ids }, colegioId, reporte: { eliminado: false } },
            include: INCLUDE_BANDEJA,
        });
    }
}
