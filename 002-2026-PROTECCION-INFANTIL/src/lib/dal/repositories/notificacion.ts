/**
 * SPEC-201 (BRIEF §5.1): repositorio de Notificacion (cola + auditoría).
 * Todo acceso a la tabla vive aquí. Endpoints/servicios llaman a este repo,
 * jamás importan `@/lib/prisma` directo (frontera DAL Q-3).
 */
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import type { CanalNotificacion, EstadoNotificacion, Prisma } from "@prisma/client";

export type NotificacionCreateInput = {
    evento: string;
    destinatarioUsuarioId?: string | null | undefined;
    destinatarioEmail: string;
    plantillaClave: string;
    canal: CanalNotificacion;
    variables: Prisma.InputJsonValue;
    sujetoTipo?: string | null | undefined;
    sujetoId?: string | null | undefined;
    enviarEn?: Date | null | undefined;
    estado?: EstadoNotificacion | undefined;
    proveedorId?: string | null | undefined;
    metadatos?: Prisma.InputJsonValue | undefined;
};

export class NotificacionRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    crear(data: NotificacionCreateInput) {
        return this.db.notificacion.create({
            data: {
                evento: data.evento,
                destinatarioUsuarioId: data.destinatarioUsuarioId ?? null,
                destinatarioEmail: data.destinatarioEmail,
                plantillaClave: data.plantillaClave,
                canal: data.canal,
                variables: data.variables,
                sujetoTipo: data.sujetoTipo ?? null,
                sujetoId: data.sujetoId ?? null,
                enviarEn: data.enviarEn ?? null,
                estado: data.estado ?? "ENCOLADA",
                proveedorId: data.proveedorId ?? null,
            },
        });
    }

    findById(id: string) {
        return this.db.notificacion.findUnique({ where: { id } });
    }

    findByProveedorId(proveedorId: string) {
        return this.db.notificacion.findFirst({ where: { proveedorId } });
    }

    /**
     * SPEC-203: bandeja in-app de un usuario. Solo envíos visibles para la
     * bandeja (no cancelados ni fallidos), ordenados por createdAt DESC.
     */
    async listarPorDestinatario(
        usuarioId: string,
        paginacion: { skip: number; take: number },
        soloNoLeidas?: boolean
    ) {
        const where: Prisma.NotificacionWhereInput = {
            destinatarioUsuarioId: usuarioId,
            canal: "IN_APP",
            estado: soloNoLeidas
                ? { in: ["ENCOLADA", "ENVIADA"] }
                : { in: ["ENCOLADA", "ENVIANDO", "ENVIADA", "ABIERTA", "CLICADA"] },
        };
        const [items, total] = await Promise.all([
            this.db.notificacion.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
            }),
            this.db.notificacion.count({ where }),
        ]);
        return { items, total };
    }

    contarNoLeidasPorDestinatario(usuarioId: string): Promise<number> {
        return this.db.notificacion.count({
            where: {
                destinatarioUsuarioId: usuarioId,
                canal: "IN_APP",
                estado: { in: ["ENCOLADA", "ENVIADA"] },
            },
        });
    }

    /**
     * SPEC-203: marca como ABIERTA una notificación in-app solo si pertenece al
     * destinatario y está en estado no leído. Devuelve el conteo de filas afectadas.
     */
    async marcarAbiertaPorDestinatario(id: string, usuarioId: string): Promise<number> {
        const { count } = await this.db.notificacion.updateMany({
            where: {
                id,
                destinatarioUsuarioId: usuarioId,
                canal: "IN_APP",
                estado: { in: ["ENCOLADA", "ENVIANDO", "ENVIADA"] },
            },
            data: { estado: "ABIERTA", openedAt: new Date() },
        });
        return count;
    }

    /**
     * SPEC-203: marca todas las notificaciones in-app no leídas de un usuario como ABIERTA.
     */
    async marcarTodasAbiertasPorDestinatario(usuarioId: string): Promise<number> {
        const { count } = await this.db.notificacion.updateMany({
            where: {
                destinatarioUsuarioId: usuarioId,
                canal: "IN_APP",
                estado: { in: ["ENCOLADA", "ENVIANDO", "ENVIADA"] },
            },
            data: { estado: "ABIERTA", openedAt: new Date() },
        });
        return count;
    }

    /**
     * Notificaciones listas para enviar: ENCOLADA/REINTENTANDO con enviarEn <= ahora.
     * Ordenadas por enviarEn ASC para respetar programación.
     */
    listarPendientesParaEnvio(ahora: Date, limite: number) {
        return this.db.notificacion.findMany({
            where: {
                estado: { in: ["ENCOLADA", "REINTENTANDO"] },
                enviarEn: { lte: ahora },
            },
            orderBy: { enviarEn: "asc" },
            take: limite,
        });
    }

    marcarEnviando(id: string) {
        return this.db.notificacion.update({
            where: { id },
            data: { estado: "ENVIANDO" },
        });
    }

    marcarEnviada(id: string, proveedorId?: string | null) {
        return this.db.notificacion.update({
            where: { id },
            data: {
                estado: "ENVIADA",
                sentAt: new Date(),
                ...(proveedorId !== undefined ? { proveedorId: proveedorId ?? null } : {}),
            },
        });
    }

    /**
     * SPEC-202: registra la confirmación de entrega por el proveedor.
     * No retrocede estados ya avanzados (ABIERTA/CLICADA/FALLIDA/CANCELADA).
     * Idempotente: no sobreescribe deliveredAt si ya existe.
     */
    async marcarDelivered(id: string, deliveredAt?: Date) {
        const timestamp = deliveredAt ?? new Date();
        await this.db.$executeRaw`
            UPDATE notificaciones
            SET "deliveredAt" = COALESCE("deliveredAt", ${timestamp})
            WHERE id = ${id}
        `;
        return this.db.notificacion.findUnique({ where: { id } });
    }

    async marcarAbierta(id: string, openedAt?: Date) {
        const timestamp = openedAt ?? new Date();
        await this.db.$executeRaw`
            UPDATE notificaciones
            SET estado = 'ABIERTA', "openedAt" = COALESCE("openedAt", ${timestamp})
            WHERE id = ${id}
        `;
        return this.db.notificacion.findUnique({ where: { id } });
    }

    async marcarClicada(id: string, clickedAt?: Date) {
        const timestamp = clickedAt ?? new Date();
        await this.db.$executeRaw`
            UPDATE notificaciones
            SET estado = 'CLICADA', "clickedAt" = COALESCE("clickedAt", ${timestamp})
            WHERE id = ${id}
        `;
        return this.db.notificacion.findUnique({ where: { id } });
    }

    marcarFallida(id: string, error: string, proximoIntento?: Date) {
        return this.db.notificacion.update({
            where: { id },
            data: {
                estado: "REINTENTANDO",
                ultimoError: error,
                intentos: { increment: 1 },
                enviarEn: proximoIntento ?? null,
            },
        });
    }

    /**
     * SPEC-292 (002-PI-192): marca la notificación como FALLIDA definitiva
     * (superó `maxIntentos`). Antes vivía inline en el worker vía prisma
     * directo; ahora reside en el DAL (Q-3).
     */
    marcarFallidaDefinitiva(id: string, intentos: number, error: string) {
        return this.db.notificacion.update({
            where: { id },
            data: {
                estado: "FALLIDA",
                intentos,
                ultimoError: error,
            },
        });
    }

    async marcarBounce(id: string, bouncedAt?: Date) {
        const timestamp = bouncedAt ?? new Date();
        await this.db.$executeRaw`
            UPDATE notificaciones
            SET "bouncedAt" = COALESCE("bouncedAt", ${timestamp})
            WHERE id = ${id}
        `;
        return this.db.notificacion.findUnique({ where: { id } });
    }

    /**
     * SPEC-202: marca una notificación como FALLIDA tras un bounce del proveedor.
     * Registra el timestamp del bounce y, opcionalmente, el mensaje de error.
     */
    marcarFallidaPorBounce(id: string, bouncedAt?: Date, error?: string) {
        return this.db.notificacion.update({
            where: { id },
            data: {
                estado: "FALLIDA",
                bouncedAt: bouncedAt ?? new Date(),
                ultimoError: error ?? null,
            },
        });
    }

    /**
     * SPEC-202: marca una notificación como FALLIDA tras una queja (complaint).
     */
    marcarFallidaPorComplaint(id: string, error?: string) {
        return this.db.notificacion.update({
            where: { id },
            data: {
                estado: "FALLIDA",
                ultimoError: error ?? null,
            },
        });
    }

    marcarCancelada(id: string, motivo: string) {
        return this.db.notificacion.update({
            where: { id },
            data: {
                estado: "CANCELADA",
                canceladoEn: new Date(),
                motivoCancelacion: motivo,
            },
        });
    }

    cancelar(criterio: {
        evento?: string | undefined;
        sujetoTipo?: string | undefined;
        sujetoId?: string | undefined;
        destinatarioUsuarioId?: string | undefined;
        canal?: CanalNotificacion | undefined;
        soloProgramadas?: boolean | undefined;
        motivo: string;
    }) {
        const where: Prisma.NotificacionWhereInput = {
            ...(criterio.evento ? { evento: criterio.evento } : {}),
            ...(criterio.sujetoTipo ? { sujetoTipo: criterio.sujetoTipo } : {}),
            ...(criterio.sujetoId ? { sujetoId: criterio.sujetoId } : {}),
            ...(criterio.destinatarioUsuarioId
                ? { destinatarioUsuarioId: criterio.destinatarioUsuarioId }
                : {}),
            ...(criterio.canal ? { canal: criterio.canal } : {}),
            ...(criterio.soloProgramadas !== false
                ? { estado: "ENCOLADA", enviarEn: { gt: new Date() } }
                : { estado: { in: ["ENCOLADA", "REINTENTANDO"] } }),
        };

        return this.db.notificacion.updateMany({
            where,
            data: {
                estado: "CANCELADA",
                canceladoEn: new Date(),
                motivoCancelacion: criterio.motivo,
            },
        });
    }

    contarPorEstado() {
        return this.db.notificacion.groupBy({
            by: ["estado"],
            _count: { estado: true },
        });
    }

    /**
     * Bandeja admin paginada con filtros.
     * No expone el texto completo del reporte ni PII: solo metadatos de envío.
     */
    async listarAdmin(filtros: {
        evento?: string | undefined;
        canal?: CanalNotificacion | undefined;
        estado?: EstadoNotificacion | undefined;
        destinatarioEmail?: string | undefined;
        fechaDesde?: Date | undefined;
        fechaHasta?: Date | undefined;
        page: number;
        pageSize: number;
    }) {
        const where: Prisma.NotificacionWhereInput = {};
        if (filtros.evento) where.evento = { contains: filtros.evento, mode: "insensitive" };
        if (filtros.canal) where.canal = filtros.canal;
        if (filtros.estado) where.estado = filtros.estado;
        if (filtros.destinatarioEmail) {
            where.destinatarioEmail = { contains: filtros.destinatarioEmail, mode: "insensitive" };
        }
        if (filtros.fechaDesde || filtros.fechaHasta) {
            where.createdAt = {};
            if (filtros.fechaDesde) where.createdAt.gte = filtros.fechaDesde;
            if (filtros.fechaHasta) where.createdAt.lte = filtros.fechaHasta;
        }

        const [items, total] = await Promise.all([
            this.db.notificacion.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (filtros.page - 1) * filtros.pageSize,
                take: filtros.pageSize,
            }),
            this.db.notificacion.count({ where }),
        ]);
        return { items, total, page: filtros.page, pageSize: filtros.pageSize };
    }

    /**
     * SPEC-202: bandeja admin paginada con where dinámico tipado.
     */
    findPaginadas(
        where: Prisma.NotificacionWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[Prisma.NotificacionGetPayload<{}>[], number]> {
        return Promise.all([
            this.db.notificacion.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
            }),
            this.db.notificacion.count({ where }),
        ]);
    }

    /** Notificaciones ENCOLADA con enviarEn futuro para un evento (impacto de recálculo). */
    contarProgramadasPorEvento(evento: string, ahora: Date = new Date()) {
        return this.db.notificacion.count({
            where: {
                evento,
                estado: "ENCOLADA",
                enviarEn: { gt: ahora },
            },
        });
    }

    /** Notificaciones ENCOLADA con enviarEn <= ahora (cola lista para envío). */
    contarEncoladasListas(ahora: Date = new Date()) {
        return this.db.notificacion.count({
            where: {
                estado: { in: ["ENCOLADA", "REINTENTANDO"] },
                enviarEn: { lte: ahora },
            },
        });
    }

    contarAtrasadas(minutosAtraso: number): Promise<number>;
    contarAtrasadas(ahora: Date, minutosAtraso: number): Promise<number>;
    contarAtrasadas(ahoraOrMinutos: Date | number, minutosAtraso?: number): Promise<number> {
        const ahora = ahoraOrMinutos instanceof Date ? ahoraOrMinutos : new Date();
        const minutos = typeof ahoraOrMinutos === "number" ? ahoraOrMinutos : (minutosAtraso ?? 15);
        const umbral = new Date(ahora.getTime() - minutos * 60_000);
        return this.db.notificacion.count({
            where: {
                estado: { in: ["ENCOLADA", "REINTENTANDO"] },
                enviarEn: { lte: umbral },
            },
        });
    }

    /** Conteos de notificaciones por estados dentro de una ventana temporal. */
    contarPorEstadosYFecha(estados: EstadoNotificacion[], desde: Date) {
        return this.db.notificacion.count({
            where: {
                estado: { in: estados },
                createdAt: { gte: desde },
            },
        });
    }

    /** Conteo de notificaciones ENVIADAS en un rango de fechas. */
    contarEnviadasEnRango(desde: Date, hasta: Date) {
        return this.db.notificacion.count({
            where: { estado: "ENVIADA", sentAt: { gte: desde, lte: hasta } },
        });
    }

    /** Conteo de notificaciones ABIERTAS/CLICADAS en un rango de fechas. */
    contarAbiertasEnRango(desde: Date, hasta: Date) {
        return this.db.notificacion.count({
            where: {
                estado: { in: ["ABIERTA", "CLICADA"] },
                openedAt: { gte: desde, lte: hasta },
            },
        });
    }

    /** Conteo de notificaciones FALLIDAS en un rango de fechas. */
    contarFallidasEnRango(desde: Date, hasta: Date) {
        return this.db.notificacion.count({
            where: { estado: "FALLIDA", createdAt: { gte: desde, lte: hasta } },
        });
    }

    /** Latencia promedio de envío (ms) para notificaciones ENVIADA en la ventana. */
    async latenciaPromedioEnvio(desde: Date): Promise<number | null> {
        const result = (await this.db.$queryRaw`
            SELECT AVG(EXTRACT(EPOCH FROM ("sentAt" - "createdAt")) * 1000) AS latencia
            FROM "notificaciones"
            WHERE estado IN ('ENVIADA', 'ABIERTA', 'CLICADA')
              AND "sentAt" >= ${desde}
        `) as [{ latencia: string | null }];
        const latencia = result[0]?.latencia;
        if (latencia === null || latencia === undefined) return null;
        return Math.round(Number(latencia));
    }

    /** Promedio de latencia (ms) entre createdAt y sentAt para envíos en rango. */
    async latenciaPromedioEnRango(desde: Date, hasta: Date): Promise<number | null> {
        const resultado = (await this.db.$queryRaw<[{ promedio: number | null }?]>`
            SELECT AVG(EXTRACT(EPOCH FROM ("sentAt" - "createdAt")) * 1000) AS promedio
            FROM "notificaciones"
            WHERE estado IN ('ENVIADA', 'ABIERTA', 'CLICADA')
              AND "sentAt" IS NOT NULL
              AND "sentAt" >= ${desde}
              AND "sentAt" <= ${hasta}
        `);
        return resultado[0]?.promedio ?? null;
    }

    /** Idempotencia por proveedorId: true si ya existe una notificación con ese id. */
    async existeProveedorId(proveedorId: string): Promise<boolean> {
        const count = await this.db.notificacion.count({ where: { proveedorId } });
        return count > 0;
    }
}
