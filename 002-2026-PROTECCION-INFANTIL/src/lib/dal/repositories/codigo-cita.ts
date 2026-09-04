/**
 * SPEC-427 (A-75 · L6) · Repositorio de los dos códigos del cierre.
 * Q-3: el acceso a Prisma vive acá; el service compone.
 */
import type { CodigoCita, Prisma, TipoCodigoCita } from "@prisma/client";
import { prisma } from "../prisma";
import type { DbClient } from "../unit-of-work";

export class CodigoCitaRepository {
    private readonly db: DbClient;
    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    crear(data: Prisma.CodigoCitaUncheckedCreateInput): Promise<CodigoCita> {
        return this.db.codigoCita.create({ data });
    }

    /**
     * El vigente de ese tipo: el más reciente que nadie usó todavía.
     *
     * Mismo criterio que `CodigoVerificacionRepository.findUltimoNoUsado` en el
     * registro del padre. Emitir uno nuevo NO borra los anteriores —la traza es
     * el conjunto de filas y el brief la exige completa—, así que lo que hace
     * inútil al viejo es que deja de ser el último.
     */
    findVigente(solicitudId: string, tipo: TipoCodigoCita): Promise<CodigoCita | null> {
        return this.db.codigoCita.findFirst({
            where: { solicitudId, tipo, usadoEn: null },
            orderBy: { creadoEn: "desc" },
        });
    }

    /** Toda la traza de una solicitud, del más nuevo al más viejo. */
    listarPorSolicitud(solicitudId: string): Promise<CodigoCita[]> {
        return this.db.codigoCita.findMany({
            where: { solicitudId },
            orderBy: { creadoEn: "desc" },
        });
    }

    /** La traza de varias solicitudes de una sola consulta (cola 2 del Verificador). */
    listarPorSolicitudes(solicitudIds: string[]): Promise<CodigoCita[]> {
        if (solicitudIds.length === 0) return Promise.resolve([]);
        return this.db.codigoCita.findMany({
            where: { solicitudId: { in: solicitudIds } },
            orderBy: { creadoEn: "desc" },
        });
    }

    contarEmitidosDesde(solicitudId: string, tipo: TipoCodigoCita, desde: Date): Promise<number> {
        return this.db.codigoCita.count({
            where: { solicitudId, tipo, creadoEn: { gte: desde } },
        });
    }

    incrementarIntentos(id: string): Promise<CodigoCita> {
        return this.db.codigoCita.update({
            where: { id },
            data: { intentosFallidos: { increment: 1 } },
        });
    }

    /**
     * Marca el uso SOLO si sigue sin usar. Si otra petición ganó la carrera,
     * `count: 0` y el llamador lo trata como código ya usado: un código de un
     * solo uso no puede cerrar dos veces la misma cita.
     */
    async marcarUsadoSiLibre(id: string, usadoEn: Date): Promise<boolean> {
        const r = await this.db.codigoCita.updateMany({
            where: { id, usadoEn: null },
            data: { usadoEn },
        });
        return r.count === 1;
    }

    anotarNotificacion(id: string, notificacionId: string): Promise<CodigoCita> {
        return this.db.codigoCita.update({ where: { id }, data: { notificacionId } });
    }
}
