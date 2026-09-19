/**
 * SPEC-714 (decisión CEO 18-09) · Repositorio de DiaBloqueado — los días que el
 * profesional CIERRA en su agenda.
 *
 * `fecha` es el día calendario Bogotá `yyyy-MM-dd` (ver `diaBogota`): la MISMA
 * etiqueta que usa el DTO del calendario (`diasBloqueados: string[]`). `bloquear`
 * SOLO inserta la fila del día —nunca lee ni toca franjas ni citas—: por eso
 * bloquear NO borra una cita confirmada (regla 2 del CEO). Es una imposibilidad
 * estructural, no una promesa de conducta. El único (profesionalId, fecha) lo
 * hace idempotente.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";
import { AppError, ERROR_CODES } from "@/lib/errors";

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Rechaza un `fecha` que no sea un día calendario `yyyy-MM-dd` REAL. */
function exigirDiaValido(fecha: string): void {
    if (!FORMATO_DIA.test(fecha)) {
        throw new AppError(`Fecha inválida: "${fecha}" (se esperaba yyyy-MM-dd)`, ERROR_CODES.VALIDATION_ERROR, 400);
    }
    // Descarta imposibles que pasan la regex (p. ej. 2026-13-40): round-trip UTC.
    const [y, m, d] = fecha.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m! - 1 || dt.getUTCDate() !== d) {
        throw new AppError(`Fecha inexistente: "${fecha}"`, ERROR_CODES.VALIDATION_ERROR, 400);
    }
}

export class DiaBloqueadoRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Cierra `fecha` para el profesional. Idempotente (único profesionalId+fecha):
     * re-bloquear no duplica ni pisa el motivo original. NO toca franjas ni citas
     * (regla 2): bloquear es «no acepto más», no «cancelo lo acordado».
     */
    async bloquear(profesionalId: string, fecha: string, motivo?: string) {
        exigirDiaValido(fecha); // async: un `fecha` inválido es un RECHAZO, no un throw síncrono.
        return this.db.diaBloqueado.upsert({
            where: { profesionalId_fecha: { profesionalId, fecha } },
            create: { profesionalId, fecha, motivo: motivo ?? null },
            update: {}, // idempotente: si ya estaba cerrado, se conserva tal cual.
        });
    }

    /** Reabre `fecha`. Idempotente: si no estaba cerrada, no hace nada. */
    async desbloquear(profesionalId: string, fecha: string): Promise<number> {
        exigirDiaValido(fecha);
        const res = await this.db.diaBloqueado.deleteMany({ where: { profesionalId, fecha } });
        return res.count;
    }

    /** ¿El profesional tiene cerrado ese día? (regla 1: no publicar franjas ahí). */
    async estaBloqueado(profesionalId: string, fecha: string): Promise<boolean> {
        const fila = await this.db.diaBloqueado.findUnique({
            where: { profesionalId_fecha: { profesionalId, fecha } },
            select: { id: true },
        });
        return fila !== null;
    }

    /**
     * Los días cerrados del profesional como `yyyy-MM-dd` — el formato EXACTO del
     * DTO del calendario (`diasBloqueados: string[]`), para que el rayado durable
     * de la pantalla sea el reflejo de la fila.
     */
    async diasBloqueadosDe(profesionalId: string): Promise<string[]> {
        const filas = await this.db.diaBloqueado.findMany({
            where: { profesionalId },
            select: { fecha: true },
            orderBy: { fecha: "asc" },
        });
        return filas.map((f) => f.fecha);
    }
}
