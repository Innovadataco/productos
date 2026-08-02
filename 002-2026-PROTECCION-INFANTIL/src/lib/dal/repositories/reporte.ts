/**
 * SPEC-053 (FR-001): repositorio del agregado Reporte.
 * Encapsula CRUD y búsquedas; acepta un cliente transaccional opcional (D2).
 * Los tipos de retorno son payloads de Prisma: solo los servicios del DAL los
 * consumen y los mapean a DTOs; NUNCA llegan a una ruta (FR-007).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const INCLUDE_CON_DETALLE = {
    plataforma: { select: { nombre: true, clave: true } },
    clasificacion: true,
} satisfies Prisma.ReporteInclude;

const SELECT_SEGUIMIENTO = {
    id: true,
    identificador: true,
    plataformaId: true,
    plataforma: { select: { clave: true, nombre: true } },
    otraPlataforma: true,
    estado: true,
    eliminado: true,
    creadoEn: true,
    actualizadoEn: true,
    numeroSeguimiento: true,
    clasificacion: true,
} satisfies Prisma.ReporteSelect;

/** E-8: select exacto de la bandeja de revisión del admin (con corrección anidada). */
const SELECT_BANDEJA_REVISION = {
    id: true,
    identificador: true,
    numeroSeguimiento: true,
    estado: true,
    esAnonimo: true,
    prioridadAlta: true,
    keywordsDetectadas: true,
    esRafaga: true,
    eliminado: true,
    motivoBaja: true,
    notaBaja: true,
    eliminadoEn: true,
    creadoEn: true,
    fechaIncidente: true,
    ciudad: true,
    pais: true,
    operadorId: true,
    comiteId: true,
    usuarioId: true,
    operador: { select: { id: true, email: true, nombre: true } },
    comite: { select: { id: true, email: true, nombre: true } },
    // N-2 (002-PI-056): el admin ve qué padre reportó (filtro y columna de la bandeja).
    usuario: { select: { id: true, email: true, nombre: true } },
    plataforma: { select: { id: true, nombre: true, clave: true } },
    clasificacion: {
        include: {
            correccion: {
                select: {
                    categoriaOriginal: true,
                    categoriaCorregida: true,
                    motivo: true,
                    creadoEn: true,
                },
            },
        },
    },
} satisfies Prisma.ReporteSelect;

/** E-8: select exacto del detalle de revisión (reintentos + corrección anidada). */
const SELECT_DETALLE_REVISION = {
    id: true,
    identificador: true,
    numeroSeguimiento: true,
    estado: true,
    texto: true,
    esAnonimo: true,
    prioridadAlta: true,
    keywordsDetectadas: true,
    esRafaga: true,
    eliminado: true,
    motivoBaja: true,
    notaBaja: true,
    eliminadoEn: true,
    creadoEn: true,
    fechaIncidente: true,
    ciudad: true,
    pais: true,
    edadVictima: true,
    plataforma: { select: { id: true, nombre: true, clave: true } },
    operador: { select: { id: true, email: true, nombre: true } },
    comite: { select: { id: true, email: true, nombre: true } },
    reintentos: { orderBy: { intento: "asc" as const } },
    clasificacion: {
        include: {
            correccion: {
                select: {
                    categoriaOriginal: true,
                    categoriaCorregida: true,
                    motivo: true,
                    confirmada: true,
                    creadoEn: true,
                },
            },
        },
    },
} satisfies Prisma.ReporteSelect;

/** E-8: select exacto de la bandeja de spam pendientes. */
const SELECT_BANDEJA_SPAM = {
    id: true,
    identificador: true,
    plataforma: { select: { id: true, nombre: true, clave: true } },
    texto: true,
    estado: true,
    creadoEn: true,
    prioridadAlta: true,
    operadorId: true,
    operador: { select: { id: true, nombre: true, email: true } },
    clasificacion: {
        select: { categoria: true, confianza: true },
    },
} satisfies Prisma.ReporteSelect;

export type ReporteBandejaRevisionRow = Prisma.ReporteGetPayload<{ select: typeof SELECT_BANDEJA_REVISION }>;
export type ReporteBandejaSpamRow = Prisma.ReporteGetPayload<{ select: typeof SELECT_BANDEJA_SPAM }>;

export type ReporteConDetalle = Prisma.ReporteGetPayload<{ include: typeof INCLUDE_CON_DETALLE }>;
export type ReporteSeguimientoRow = Prisma.ReporteGetPayload<{ select: typeof SELECT_SEGUIMIENTO }>;

export interface PaginacionInput {
    skip: number;
    take: number;
}

export class ReporteRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    findByIdConDetalle(id: string): Promise<ReporteConDetalle | null> {
        return this.db.reporte.findUnique({ where: { id }, include: INCLUDE_CON_DETALLE });
    }

    /** E-8: lectura con la clasificación (corrección admin) — mismo include que la ruta. */
    findByIdConClasificacion(id: string) {
        return this.db.reporte.findUnique({
            where: { id },
            include: { clasificacion: true },
        });
    }

    /** E-8: lectura con clasificación y embedding (anonimizar admin) — mismo include que la ruta. */
    findByIdConClasificacionYEmbedding(id: string) {
        return this.db.reporte.findUnique({
            where: { id },
            include: { clasificacion: true, embedding: true },
        });
    }

    /** E-8: permisos de gestión con baja (baja/transiciones: incluye `eliminado`). */
    findPermisosGestion(id: string) {
        return this.db.reporte.findUnique({
            where: { id },
            select: { id: true, estado: true, operadorId: true, tenantId: true, eliminado: true },
        });
    }

    /** E-8: permisos de gestión sin baja (escalar/reasignar). */
    findPermisosGestionBasico(id: string) {
        return this.db.reporte.findUnique({
            where: { id },
            select: { id: true, estado: true, operadorId: true, tenantId: true },
        });
    }

    /** E-8: permisos del caso para la vista de revisión (operador/comité/tenant). */
    findPermisosRevision(id: string) {
        return this.db.reporte.findUnique({
            where: { id },
            select: { operadorId: true, comiteId: true, tenantId: true },
        });
    }

    /** E-8: bandeja de revisión del admin (select exacto de la ruta, con corrección). */
    findBandejaRevision(
        where: Prisma.ReporteWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[ReporteBandejaRevisionRow[], number]> {
        return Promise.all([
            this.db.reporte.findMany({
                where,
                orderBy: [{ prioridadAlta: "desc" }, { creadoEn: "desc" }],
                skip: paginacion.skip,
                take: paginacion.take,
                select: SELECT_BANDEJA_REVISION,
            }),
            this.db.reporte.count({ where }),
        ]);
    }

    /** E-8: detalle de revisión con reintentos y corrección (select exacto de la ruta). */
    findDetalleRevision(id: string) {
        return this.db.reporte.findUnique({
            where: { id },
            select: SELECT_DETALLE_REVISION,
        });
    }

    /** E-8: bandeja de spam pendientes (select exacto de la ruta). */
    findBandejaSpam(
        where: Prisma.ReporteWhereInput,
        paginacion: { skip: number; take: number }
    ): Promise<[ReporteBandejaSpamRow[], number]> {
        return Promise.all([
            this.db.reporte.findMany({
                where,
                orderBy: [{ prioridadAlta: "desc" }, { creadoEn: "desc" }],
                skip: paginacion.skip,
                take: paginacion.take,
                select: SELECT_BANDEJA_SPAM,
            }),
            this.db.reporte.count({ where }),
        ]);
    }

    /** E-8: solo textoOriginal cifrado (revelar-original; el descifrado es de la ruta). */
    findTextoOriginalCifrado(id: string) {
        return this.db.reporte.findUnique({
            where: { id },
            select: { textoOriginal: true },
        });
    }

    /** Lectura mínima para flujos de estado (fallback del worker). */
    findByIdBasico(id: string) {
        return this.db.reporte.findUnique({
            where: { id },
            select: { id: true, estado: true, numeroSeguimiento: true, identificador: true },
        });
    }

    /** SPEC-134 (E-1): estado/identificador/eliminado para notificar alertas a colegios. */
    findEstadoParaNotificacion(id: string) {
        return this.db.reporte.findUnique({
            where: { id },
            select: { id: true, identificador: true, estado: true, eliminado: true },
        });
    }

    findByNumeroSeguimiento(numeroSeguimiento: string): Promise<ReporteSeguimientoRow | null> {
        return this.db.reporte.findUnique({
            where: { numeroSeguimiento },
            select: SELECT_SEGUIMIENTO,
        });
    }

    /** Listado paginado del autor ("mis reportes"): items + total en una pasada. */
    findPaginadosConTotal(
        where: Prisma.ReporteWhereInput,
        paginacion: PaginacionInput
    ): Promise<[ReporteConDetalle[], number]> {
        return Promise.all([
            this.db.reporte.findMany({
                where,
                orderBy: { creadoEn: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: INCLUDE_CON_DETALLE,
            }),
            this.db.reporte.count({ where }),
        ]);
    }

    /** Deduplicación autenticada: mismo usuario + identificador desde `desde`. */
    findDuplicadoReciente(usuarioId: string, identificador: string, desde: Date) {
        return this.db.reporte.findFirst({
            where: { usuarioId, identificador, creadoEn: { gte: desde } },
            orderBy: { creadoEn: "desc" },
        });
    }

    /**
     * SPEC-137 (E-5): advisory lock de PostgreSQL por (usuario, identificador),
     * tomado DENTRO de la transacción de creación. Cierra la carrera de la
     * deduplicación con read-committed: la 2ª request concurrente espera en el
     * lock hasta el commit de la 1ª y su chequeo dedup posterior ya ve el reporte.
     * Fuera de una tx explícita es inofensivo (el lock vive solo el statement).
     */
    async tomarLockDedup(usuarioId: string, identificador: string): Promise<void> {
        await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${usuarioId + "|" + identificador}))`;
    }

    existeNumeroSeguimiento(numeroSeguimiento: string): Promise<boolean> {
        return this.db.reporte
            .findUnique({ where: { numeroSeguimiento }, select: { id: true } })
            .then((r) => r !== null);
    }

    crear(data: Prisma.ReporteUncheckedCreateInput) {
        return this.db.reporte.create({ data });
    }

    actualizarEstado(id: string, data: Prisma.ReporteUncheckedUpdateInput) {
        return this.db.reporte.update({ where: { id }, data });
    }

    /** Reportes aprobados de un identificador para la consulta pública (spec 089-US3). */
    findAprobadosPorIdentificador(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.findMany({
            where,
            select: {
                id: true,
                ciudad: true,
                pais: true,
                creadoEn: true,
                fechaIncidente: true,
                esAnonimo: true,
                plataforma: { select: { id: true, nombre: true, clave: true } },
                clasificacion: { select: { categoria: true, confianza: true, categoriasSecundarias: true } },
                ciudadRel: { select: { nombre: true, lat: true, lng: true, departamento: { select: { nombre: true } } } },
                otraPlataforma: true,
            },
            orderBy: { creadoEn: "desc" },
            take: 1000,
        });
    }

    /** Reportes en estados visibles de un identificador para el detalle autenticado. */
    findVisiblesPorIdentificador(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.findMany({
            where,
            select: {
                id: true,
                esAnonimo: true,
                creadoEn: true,
                plataforma: { select: { id: true, nombre: true, clave: true } },
                otraPlataforma: true,
                ciudad: true,
                pais: true,
                ciudadRel: { select: { lat: true, lng: true } },
                clasificacion: { select: { categoria: true, confianza: true } },
            },
            orderBy: { creadoEn: "desc" },
            take: 1000,
        });
    }

    /** Conteo genérico (casos por operador, sin asignar, etc.). */
    countWhere(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.count({ where });
    }

    /** Distribución de casos en revisión manual por operador. */
    groupByOperador(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.groupBy({
            by: ["operadorId"],
            where,
            _count: { operadorId: true },
        });
    }

    /** E-8: conteo agregado de reportes por autor (listado admin de padres; sin contenido). */
    contarPorUsuarios(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.groupBy({
            by: ["usuarioId"],
            where,
            _count: { _all: true },
        });
    }

    /** Tabla operativa de clasificación (admin): items + total con el select exacto. */
    findTablaClasificacion(where: Prisma.ReporteWhereInput, paginacion: { skip: number; take: number }) {
        return Promise.all([
            this.db.reporte.findMany({
                where,
                orderBy: [{ prioridadAlta: "desc" }, { creadoEn: "desc" }],
                skip: paginacion.skip,
                take: paginacion.take,
                select: {
                    id: true,
                    identificador: true,
                    numeroSeguimiento: true,
                    estado: true,
                    prioridadAlta: true,
                    creadoEn: true,
                    ciudad: true,
                    pais: true,
                    operador: { select: { id: true, email: true, nombre: true } },
                    clasificacion: { select: { categoria: true } },
                },
            }),
            this.db.reporte.count({ where }),
        ]);
    }

    /** Mínimo para simulaciones (export/resultados/comparar): identificador y estado. */
    findMinimosPorIds(ids: string[]) {
        return this.db.reporte.findMany({
            where: { id: { in: ids } },
            select: { id: true, identificador: true, estado: true },
        });
    }

    /** Reportes de un identificador + plataforma (detalle de apelación del comité, SPEC-110). */
    findPorIdentificadorYPlataforma(identificador: string, plataformaId: string) {
        return this.db.reporte.findMany({
            where: { identificador, plataformaId },
            orderBy: { creadoEn: "desc" },
            select: {
                id: true,
                estado: true,
                eliminado: true,
                motivoBaja: true,
                creadoEn: true,
                ciudad: true,
                pais: true,
                texto: true,
                clasificacion: { select: { categoria: true, confianza: true } },
            },
        });
    }

    /** Ids de reportes que cumplen el filtro (validación de reportes a bajar, SPEC-110). */
    findIdsWhere(where: Prisma.ReporteWhereInput) {
        return this.db.reporte.findMany({
            where,
            select: { id: true },
        });
    }

    /** Asignación del caso a un miembro del comité (escalamiento). */
    asignarComite(id: string, comiteId: string) {
        return this.db.reporte.update({
            where: { id },
            data: { comiteId },
        });
    }

    /** E-8: reporte con todo lo que alimenta las etapas del expediente (spec 096). */
    findParaExpediente(id: string) {
        return this.db.reporte.findUnique({
            where: { id },
            include: {
                plataforma: { select: { nombre: true } },
                fuente: true,
                embedding: true,
                clasificacion: { include: { rubricaVotos: true } },
                transiciones: { orderBy: { creadoEn: "asc" } },
                reintentos: { orderBy: { intento: "asc" } },
            },
        });
    }

    /** E-8: estados de reportes por ids (progreso de simulaciones). */
    findEstadosPorIds(ids: string[]) {
        return this.db.reporte.findMany({
            where: { id: { in: ids } },
            select: { estado: true },
        });
    }
}
