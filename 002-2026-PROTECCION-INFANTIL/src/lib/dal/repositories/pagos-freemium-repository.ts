/**
 * SPEC-217 (002-PI-117): repositorio DAL del freemium del módulo de pagos.
 * Extraído por max-lines de `pagos-repository.ts` (mismo patrón que
 * `pagos-vigencia-repository.ts`): las consultas de activación, histórico y
 * conversión del freemium viven aquí; servicios y endpoints deben usar esta
 * clase en lugar de importar `@/lib/prisma` directamente.
 */
import type { Prisma, TipoTitular } from "@prisma/client";
import { DuracionPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class PagosFreemiumRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * FR-004: true si el titular (por `usuarioId` padre o `colegioId` rector)
     * ya tuvo freemium histórico. El histórico se detecta por
     * `freemiumFechaFin != null` (sobrevive a la conversión `esFreemium=false`).
     */
    async tieneFreemiumHistorico(filtro: { usuarioId?: string | undefined; colegioId?: string | undefined }): Promise<boolean> {
        const OR: Prisma.SuscripcionWhereInput[] = [];
        if (filtro.usuarioId) OR.push({ usuarioId: filtro.usuarioId });
        if (filtro.colegioId) OR.push({ colegioId: filtro.colegioId });
        if (OR.length === 0) return false;
        const count = await this.db.suscripcion.count({
            where: { freemiumFechaFin: { not: null }, OR },
        });
        return count > 0;
    }

    /** FR-002: plan básico (MES_1) activo del tipo de titular para el año dado. */
    obtenerPlanBasico(tipoTitular: TipoTitular, anio: number) {
        return this.db.plan.findFirst({
            where: {
                tipoTitular,
                duracion: DuracionPlan.MES_1,
                anio,
                activo: true,
            },
        });
    }

    /** Creación de la suscripción (con o sin freemium) del servicio compartido. */
    crearSuscripcion(data: Prisma.SuscripcionUncheckedCreateInput) {
        return this.db.suscripcion.create({ data });
    }

    /** Datos freemium de una suscripción para la conversión por pago. */
    obtenerSuscripcionFreemiumPorId(id: string) {
        return this.db.suscripcion.findUnique({
            where: { id },
            select: {
                id: true,
                estado: true,
                esFreemium: true,
                freemiumFechaFin: true,
                fechaFin: true,
                colegioId: true,
                usuarioId: true,
            },
        });
    }

    /** Actualización de la suscripción al convertir el freemium por pago. */
    actualizarSuscripcion(id: string, data: Prisma.SuscripcionUncheckedUpdateInput) {
        return this.db.suscripcion.update({ where: { id }, data });
    }
}
