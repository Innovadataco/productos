/**
 * SPEC-226 (002-PI-mega-cola): repositorio DAL del ejecutor de acciones
 * automáticas. Aísla TODO el acceso a Prisma del dominio (frontera Q-3): el
 * ejecutor, los handlers y los endpoints `aplicar`/`revertir` consumen esta
 * clase; fuera de aquí nadie importa `@/lib/prisma` para este dominio.
 *
 * Incluye las lecturas de soporte que los handlers necesitan (suscripción
 * sujeto, admins/operadores activos, usos de bono) y el bloqueo de fila de la
 * recomendación (`SELECT ... FOR UPDATE` parametrizado, solo dentro de TX).
 * Ningún método lee texto de reportes ni datos de menores.
 */
import { Prisma, type EjecucionAccion, type Recomendacion, type ReglaRecomendacion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export type RecomendacionConRegla = Recomendacion & { regla: ReglaRecomendacion };

export interface SuscripcionParaAccion {
    id: string;
    estado: string;
    usuarioId: string | null;
}

export interface UsuarioActivoId {
    id: string;
    creadoEn: Date;
}

export interface AsignacionViva {
    resultado: Prisma.JsonValue;
    ejecutadaEn: Date;
}

export class EjecucionAccionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    obtenerRecomendacionConRegla(id: string): Promise<RecomendacionConRegla | null> {
        return this.db.recomendacion.findUnique({ where: { id }, include: { regla: true } });
    }

    /**
     * Abre UNA transacción de Prisma para el ejecutor (acción + EjecucionAccion
     * + recomendación + AuditLog atómicos, FR-015). El runner vive aquí porque
     * `src/lib/analisis/**` no puede importar `@/lib/prisma` (frontera Q-3).
     */
    ejecutarEnTransaccion<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        return prisma.$transaction(fn);
    }

    /**
     * Bloqueo de fila de la recomendación antes de actuar (doble ejecución
     * concurrente, edge case de la spec). SOLO dentro de una transacción.
     */
    async bloquearRecomendacion(id: string): Promise<{ id: string; estado: string } | null> {
        const filas = await this.db.$queryRaw<{ id: string; estado: string }[]>`
            SELECT id, estado::text AS estado
            FROM "recomendaciones"
            WHERE id = ${id}
            FOR UPDATE
        `;
        return filas[0] ?? null;
    }

    crearEjecucion(data: Prisma.EjecucionAccionUncheckedCreateInput): Promise<EjecucionAccion> {
        return this.db.ejecucionAccion.create({ data });
    }

    obtenerEjecucionPorId(id: string): Promise<EjecucionAccion | null> {
        return this.db.ejecucionAccion.findUnique({ where: { id } });
    }

    /** La ejecución EJECUTADA más reciente de una recomendación (candidata a rollback). */
    buscarUltimaEjecutadaPorRecomendacion(recomendacionId: string): Promise<EjecucionAccion | null> {
        return this.db.ejecucionAccion.findFirst({
            where: { recomendacionId, estado: "EJECUTADA" },
            orderBy: { ejecutadaEn: "desc" },
        });
    }

    marcarRevertida(id: string, revertidaPorAdminId: string, motivoReversion: string): Promise<EjecucionAccion> {
        return this.db.ejecucionAccion.update({
            where: { id },
            data: { estado: "REVERTIDA", revertidaEn: new Date(), revertidaPorAdminId, motivoReversion },
        });
    }

    /**
     * Fusiona un patch en `resultado` (read-modify-write). Los parches llegan
     * del `notificar()` post-TX (programadas/canceladas del Motor Notif).
     */
    async fusionarResultado(id: string, patch: Record<string, unknown>): Promise<EjecucionAccion> {
        const actual = await this.db.ejecucionAccion.findUnique({ where: { id }, select: { resultado: true } });
        const base =
            actual?.resultado && typeof actual.resultado === "object" && !Array.isArray(actual.resultado)
                ? (actual.resultado as Record<string, unknown>)
                : {};
        return this.db.ejecucionAccion.update({
            where: { id },
            data: { resultado: { ...base, ...patch } as Prisma.InputJsonValue },
        });
    }

    /**
     * Asignaciones operador vivas: ejecuciones ASIGNAR_OPERADOR en estado
     * EJECUTADA cuya recomendación sigue PENDIENTE (sin resolver). Alimenta la
     * estrategia `menor_carga`.
     */
    listarAsignacionesVivas(): Promise<AsignacionViva[]> {
        return this.db.ejecucionAccion.findMany({
            where: {
                tipoAccion: "ASIGNAR_OPERADOR",
                estado: "EJECUTADA",
                recomendacion: { estado: "PENDIENTE" },
            },
            select: { resultado: true, ejecutadaEn: true },
        });
    }

    /** Marca la recomendación APLICADA tras una ejecución exitosa. */
    marcarRecomendacionAplicada(
        id: string,
        params: { ejecutadaAutomatica: boolean; resueltaPorAdminId: string | null; motivoResolucion: string }
    ): Promise<Recomendacion> {
        return this.db.recomendacion.update({
            where: { id },
            data: {
                estado: "APLICADA",
                ejecutadaAutomatica: params.ejecutadaAutomatica,
                resueltaEn: new Date(),
                resueltaPorAdminId: params.resueltaPorAdminId,
                motivoResolucion: params.motivoResolucion,
            },
        });
    }

    /** Rollback de ASIGNAR_OPERADOR: la recomendación vuelve a PENDIENTE sin operador. */
    devolverRecomendacionAPendiente(id: string): Promise<Recomendacion> {
        return this.db.recomendacion.update({
            where: { id },
            data: {
                estado: "PENDIENTE",
                ejecutadaAutomatica: false,
                resueltaEn: null,
                resueltaPorAdminId: null,
                motivoResolucion: null,
            },
        });
    }

    obtenerSuscripcionParaAccion(id: string): Promise<SuscripcionParaAccion | null> {
        return this.db.suscripcion.findUnique({
            where: { id },
            select: { id: true, estado: true, usuarioId: true },
        });
    }

    listarAdminsActivosIds(): Promise<UsuarioActivoId[]> {
        return this.db.usuario.findMany({
            where: { rol: "ADMIN", estado: "activo" },
            select: { id: true, creadoEn: true },
            orderBy: { creadoEn: "asc" },
        });
    }

    listarOperadoresActivosIds(): Promise<UsuarioActivoId[]> {
        return this.db.usuario.findMany({
            where: { rol: "OPERADOR", estado: "activo" },
            select: { id: true, creadoEn: true },
            orderBy: { creadoEn: "asc" },
        });
    }

    /** Operador activo por id (validación del operadorId explícito). */
    obtenerOperadorActivo(id: string): Promise<UsuarioActivoId | null> {
        return this.db.usuario.findFirst({
            where: { id, rol: "OPERADOR", estado: "activo" },
            select: { id: true, creadoEn: true },
        });
    }

    /** Usos ya aplicados de un bono (rollback honesto: no se tocan). */
    contarUsosBono(bonoId: string): Promise<number> {
        return this.db.bonoAplicado.count({ where: { bonoId } });
    }
}
