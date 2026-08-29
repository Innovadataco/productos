/**
 * SPEC-213 (002-PI-113): repositorio DAL de vigencia y transiciones automáticas
 * del módulo de pagos. Extraído de `pagos-repository.ts` (max-lines 500): las
 * consultas del worker de vigencia viven aquí; endpoints y servicios deben usar
 * esta clase en lugar de importar `@/lib/prisma` directamente.
 */
import type { Prisma } from "@prisma/client";
import { EstadoSuscripcion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import type { PaginacionParams } from "./pagos-repository";

export class PagosVigenciaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Include común de las consultas de vigencia: datos mínimos del titular
     * para resolver destinatarios de notificación (admin del colegio con
     * fallback al representante legal, o el usuario padre).
     */
    private static readonly includeVigencia = {
        planActual: { select: { id: true, nombre: true } },
        colegio: {
            select: {
                id: true,
                nombre: true,
                representanteLegalNombre: true,
                representanteLegalEmail: true,
                admin: { select: { id: true, email: true, nombre: true } },
            },
        },
        usuario: { select: { id: true, email: true, nombre: true } },
    } satisfies Prisma.SuscripcionInclude;

    /** Suscripciones ACTIVA con fechaFin <= limiteUtc (candidatas a EN_GRACIA). */
    listarActivasPorVencer(limiteUtc: Date, take: number) {
        const where: Prisma.SuscripcionWhereInput = {
            estado: EstadoSuscripcion.ACTIVA,
            fechaFin: { lte: limiteUtc },
        };
        return this.db.suscripcion.findMany({
            where,
            orderBy: { fechaFin: "asc" },
            take,
            include: PagosVigenciaRepository.includeVigencia,
        });
    }

    /** Suscripciones EN_GRACIA con fechaCorteProgramado <= limiteUtc (candidatas a SUSPENDIDA). */
    listarEnGraciaPorCortar(limiteUtc: Date, take: number) {
        const where: Prisma.SuscripcionWhereInput = {
            estado: EstadoSuscripcion.EN_GRACIA,
            fechaCorteProgramado: { lte: limiteUtc },
        };
        return this.db.suscripcion.findMany({
            where,
            orderBy: { fechaCorteProgramado: "asc" },
            take,
            include: PagosVigenciaRepository.includeVigencia,
        });
    }

    /** Suscripciones ACTIVA freemium con freemiumFechaFin < limiteUtc (candidatas a SUSPENDIDA). */
    listarFreemiumVencidas(limiteUtc: Date, take: number) {
        const where: Prisma.SuscripcionWhereInput = {
            estado: EstadoSuscripcion.ACTIVA,
            esFreemium: true,
            freemiumFechaFin: { lt: limiteUtc },
        };
        return this.db.suscripcion.findMany({
            where,
            orderBy: { freemiumFechaFin: "asc" },
            take,
            include: PagosVigenciaRepository.includeVigencia,
        });
    }

    /** Suscripciones ACTIVA con fechaFin dentro de la ventana [desdeUtc, hastaUtc] (recordatorios T-5/T-1). */
    listarActivasEnVentanaFechaFin(desdeUtc: Date, hastaUtc: Date, paginacion: PaginacionParams) {
        const where: Prisma.SuscripcionWhereInput = {
            estado: EstadoSuscripcion.ACTIVA,
            fechaFin: { gte: desdeUtc, lte: hastaUtc },
        };
        return this.db.suscripcion.findMany({
            where,
            orderBy: { fechaFin: "asc" },
            skip: paginacion.skip,
            take: paginacion.take,
            include: PagosVigenciaRepository.includeVigencia,
        });
    }

    /** Suscripciones EN_GRACIA con fechaFin dentro de la ventana (recordatorio día 2 de gracia). */
    listarEnGraciaConFechaFinEn(desdeUtc: Date, hastaUtc: Date, paginacion: PaginacionParams) {
        const where: Prisma.SuscripcionWhereInput = {
            estado: EstadoSuscripcion.EN_GRACIA,
            fechaFin: { gte: desdeUtc, lte: hastaUtc },
        };
        return this.db.suscripcion.findMany({
            where,
            orderBy: { fechaFin: "asc" },
            skip: paginacion.skip,
            take: paginacion.take,
            include: PagosVigenciaRepository.includeVigencia,
        });
    }

    /** Suscripciones ACTIVA freemium con freemiumFechaFin dentro de la ventana (recordatorios T-7/T-1). */
    listarFreemiumEnVentana(desdeUtc: Date, hastaUtc: Date, paginacion: PaginacionParams) {
        const where: Prisma.SuscripcionWhereInput = {
            estado: EstadoSuscripcion.ACTIVA,
            esFreemium: true,
            freemiumFechaFin: { gte: desdeUtc, lte: hastaUtc },
        };
        return this.db.suscripcion.findMany({
            where,
            orderBy: { freemiumFechaFin: "asc" },
            skip: paginacion.skip,
            take: paginacion.take,
            include: PagosVigenciaRepository.includeVigencia,
        });
    }

    /**
     * Transición optimista: solo aplica si la suscripción sigue en
     * `estadoEsperado`. Devuelve el número de filas actualizadas (0 = ya
     * transitada por otra corrida; garantiza idempotencia a nivel de fila).
     */
    transitarSuscripcionSiEstado(
        id: string,
        estadoEsperado: EstadoSuscripcion,
        data: Prisma.SuscripcionUncheckedUpdateInput
    ) {
        return this.db.suscripcion.updateMany({
            where: { id, estado: estadoEsperado },
            data,
        });
    }

    /** Lee un parámetro crudo de ParametroSistema (sin descifrado; los de vigencia no son secretos). */
    obtenerParametroVigencia(clave: string) {
        return this.db.parametroSistema.findUnique({ where: { clave } });
    }

    /** Escribe (upsert) un parámetro de control del worker de vigencia. */
    guardarParametroVigencia(clave: string, valor: string, descripcion: string) {
        return this.db.parametroSistema.upsert({
            where: { clave },
            update: { valor },
            create: {
                clave,
                valor,
                tipo: "STRING",
                categoria: "SYSTEM",
                esPublico: false,
                descripcion,
            },
        });
    }
}
