/**
 * SPEC-210/212/214 (002-PI-110/112/114): repositorio DAL del módulo de pagos.
 * Aísla el acceso a Prisma; endpoints y servicios de pagos deben usar esta
 * clase en lugar de importar `@/lib/prisma` directamente.
 */
import type { Prisma } from "@prisma/client";
import { TipoTitular, DuracionPlan, EstadoPago, EstadoSuscripcion, OrigenSuscripcion, RolUsuario, MetodoPagoManual } from "@prisma/client";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { addDays, startOfDay, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const ZONA_BOGOTA = "America/Bogota";

function ahoraBogota(): Date {
    return toZonedTime(new Date(), ZONA_BOGOTA);
}

export interface PaginacionParams {
    skip: number;
    take: number;
}

export interface ResultadoPaginado<T> {
    items: T[];
    total: number;
}

export interface ColegioResumen {
    id: string;
    nombre: string;
}

export interface UsuarioResumen {
    id: string;
    nombre: string | null;
    email: string;
}

export interface PlanResumen {
    id: string;
    nombre: string;
    tipoTitular: string;
    duracion: string;
    anio: number;
    precioBaseUSD: number;
    precioBaseCOP: number | null;
    esFreemium: boolean;
    usosMaximosPorCliente: number | null;
    activo: boolean;
    descuentoAnualPct: number | null;
    descripcion: string | null;
}

export interface SuscripcionConPlanYTitular {
    id: string;
    estado: EstadoSuscripcion;
    fechaInicio: Date;
    fechaFin: Date;
    monedaLocal: string;
    planActual: PlanResumen;
    colegio: ColegioResumen | null;
    usuario: UsuarioResumen | null;
}

export interface PagoConSuscripcion {
    id: string;
    estado: EstadoPago;
    montoNetoUSD: number;
    monedaLocal: string;
    montoLocalPagado: number;
    metodoDeclarado: string;
    fechaReporte: Date;
    suscripcionId: string;
    suscripcion: {
        colegio: ColegioResumen | null;
        usuario: UsuarioResumen | null;
    };
}

export interface BonoPromocionalResumen {
    id: string;
    nombre: string;
    tipo: string;
    valor: number;
    vigenciaInicio: Date;
    vigenciaFin: Date;
    activo: boolean;
}

export interface TargetSinSuscripcion {
    id: string;
    tipo: "PADRE" | "COLEGIO";
    nombre: string | null;
    email: string;
    identificacion: string | null;
}

export class PagosRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    // ── Plan ──

    crearPlan(data: Prisma.PlanUncheckedCreateInput) {
        return this.db.plan.create({ data });
    }

    obtenerPlanPorId(id: string) {
        return this.db.plan.findUnique({ where: { id } });
    }

    obtenerPlanPorClave(tipoTitular: TipoTitular, duracion: DuracionPlan, anio: number) {
        return this.db.plan.findUnique({
            where: {
                tipoTitular_duracion_anio: {
                    tipoTitular,
                    duracion,
                    anio,
                },
            },
        });
    }

    listarPlanes(where?: Prisma.PlanWhereInput) {
        return this.db.plan.findMany({
            where: where ?? {},
            orderBy: { createdAt: "desc" },
        });
    }

    async listarPlanesPaginados(
        where: Prisma.PlanWhereInput,
        paginacion: PaginacionParams
    ): Promise<ResultadoPaginado<PlanResumen>> {
        const [items, total] = await Promise.all([
            this.db.plan.findMany({
                where,
                orderBy: [{ anio: "desc" }, { tipoTitular: "asc" }, { duracion: "asc" }],
                skip: paginacion.skip,
                take: paginacion.take,
            }),
            this.db.plan.count({ where }),
        ]);
        return { items, total };
    }

    actualizarPlan(id: string, data: Prisma.PlanUncheckedUpdateInput) {
        return this.db.plan.update({ where: { id }, data });
    }

    /**
     * SPEC-243 (002-PI-146): desactivación lógica de un plan.
     */
    desactivarPlan(id: string) {
        return this.db.plan.update({ where: { id }, data: { activo: false } });
    }

    obtenerPlanPorNombreYTipoTitular(nombre: string, tipoTitular: TipoTitular) {
        return this.db.plan.findFirst({
            where: { nombre, tipoTitular },
        });
    }

    /**
     * SPEC-243 (002-PI-146): verifica si existe al menos una suscripción activa
     * asociada al plan.
     */
    async existeSuscripcionActivaPorPlan(planId: string): Promise<boolean> {
        const count = await this.db.suscripcion.count({
            where: {
                planActualId: planId,
                estado: EstadoSuscripcion.ACTIVA,
            },
        });
        return count > 0;
    }

    // ── Suscripción ──

    crearSuscripcion(data: Prisma.SuscripcionUncheckedCreateInput) {
        return this.db.suscripcion.create({ data });
    }

    obtenerSuscripcionPorId(id: string) {
        return this.db.suscripcion.findUnique({
            where: { id },
            include: {
                planActual: true,
                colegio: { select: { id: true, nombre: true } },
                usuario: { select: { id: true, nombre: true, email: true } },
            },
        });
    }

    listarSuscripcionesPorColegio(colegioId: string) {
        return this.db.suscripcion.findMany({ where: { colegioId } });
    }

    listarSuscripcionesPorUsuario(usuarioId: string) {
        return this.db.suscripcion.findMany({ where: { usuarioId } });
    }

    /**
     * SPEC-242: última suscripción de un usuario (cualquier estado).
     */
    obtenerSuscripcionPorUsuarioId(usuarioId: string) {
        return this.db.suscripcion.findFirst({
            where: { usuarioId },
            orderBy: { fechaInicio: "desc" },
            include: { planActual: true },
        });
    }

    /**
     * SPEC-242: suscripción vigente del usuario (ACTIVA o EN_GRACIA), más reciente primero.
     */
    obtenerSuscripcionActivaPorUsuarioId(usuarioId: string) {
        return this.db.suscripcion.findFirst({
            where: {
                usuarioId,
                estado: { in: [EstadoSuscripcion.ACTIVA, EstadoSuscripcion.EN_GRACIA] },
            },
            orderBy: [{ estado: "asc" }, { fechaInicio: "desc" }],
            include: { planActual: true },
        });
    }

    actualizarSuscripcion(id: string, data: Prisma.SuscripcionUncheckedUpdateInput) {
        return this.db.suscripcion.update({ where: { id }, data });
    }

    // ── Pago ──

    crearPago(data: Prisma.PagoUncheckedCreateInput) {
        return this.db.pago.create({ data });
    }

    obtenerPagoPorId(id: string) {
        return this.db.pago.findUnique({ where: { id } });
    }

    listarPagosPorSuscripcion(suscripcionId: string) {
        return this.db.pago.findMany({
            where: { suscripcionId },
            orderBy: { createdAt: "desc" },
        });
    }

    actualizarPago(id: string, data: Prisma.PagoUncheckedUpdateInput) {
        return this.db.pago.update({ where: { id }, data });
    }

    /**
     * SPEC-212: pagos pendientes de autorización con búsqueda por email/identificador
     * del titular (colegio o padre).
     */
    async listarPagosPendientes(
        filtros: { q?: string | undefined },
        paginacion: PaginacionParams
    ): Promise<ResultadoPaginado<PagoConSuscripcion>> {
        const whereBase: Prisma.PagoWhereInput = { estado: EstadoPago.PENDIENTE_AUTORIZACION };
        const where: Prisma.PagoWhereInput = { ...whereBase };

        if (filtros.q) {
            const q = filtros.q.trim();
            where.suscripcion = {
                OR: [
                    { colegio: { nombre: { contains: q, mode: "insensitive" } } },

                    { usuario: { nombre: { contains: q, mode: "insensitive" } } },
                    { usuario: { email: { contains: q, mode: "insensitive" } } },
                ],
            };
        }

        const [items, total] = await Promise.all([
            this.db.pago.findMany({
                where,
                orderBy: { fechaReporte: "asc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: {
                    suscripcion: {
                        include: {
                            colegio: { select: { id: true, nombre: true } },
                            usuario: { select: { id: true, nombre: true, email: true } },
                        },
                    },
                },
            }),
            this.db.pago.count({ where }),
        ]);

        return { items, total };
    }

    /**
     * SPEC-212: suscripciones activas con fechaFin <= hoy + N días (Bogotá).
     */
    async listarVencimientosProximos(
        filtros: { dias?: number },
        paginacion: PaginacionParams
    ): Promise<ResultadoPaginado<SuscripcionConPlanYTitular>> {
        const dias = Math.max(1, Math.min(filtros.dias ?? 7, 90));
        const hoyBogota = ahoraBogota();
        const limiteBogota = endOfDay(addDays(hoyBogota, dias));
        const limiteUtc = new Date(formatInTimeZone(limiteBogota, ZONA_BOGOTA, "yyyy-MM-dd'T'HH:mm:ssXXX"));

        const where: Prisma.SuscripcionWhereInput = {
            estado: EstadoSuscripcion.ACTIVA,
            fechaFin: { lte: limiteUtc },
        };

        const [items, total] = await Promise.all([
            this.db.suscripcion.findMany({
                where,
                orderBy: { fechaFin: "asc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: {
                    planActual: true,
                    colegio: { select: { id: true, nombre: true } },
                    usuario: { select: { id: true, nombre: true, email: true } },
                },
            }),
            this.db.suscripcion.count({ where }),
        ]);

        return { items, total };
    }

    /**
     * SPEC-212: suscripciones en mora (EN_GRACIA o SUSPENDIDA).
     */
    async listarMora(
        filtros: { estado?: EstadoSuscripcion | undefined },
        paginacion: PaginacionParams
    ): Promise<ResultadoPaginado<SuscripcionConPlanYTitular>> {
        const estadosMora: EstadoSuscripcion[] = [EstadoSuscripcion.EN_GRACIA, EstadoSuscripcion.SUSPENDIDA];
        const where: Prisma.SuscripcionWhereInput = {
            estado: filtros.estado && estadosMora.includes(filtros.estado) ? filtros.estado : { in: estadosMora },
        };

        const [items, total] = await Promise.all([
            this.db.suscripcion.findMany({
                where,
                orderBy: { fechaFin: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: {
                    planActual: true,
                    colegio: { select: { id: true, nombre: true } },
                    usuario: { select: { id: true, nombre: true, email: true } },
                },
            }),
            this.db.suscripcion.count({ where }),
        ]);

        return { items, total };
    }

    /**
     * SPEC-212: registra un reembolso sobre un pago autorizado.
     */
    async registrarReembolso(
        id: string,
        data: {
            montoReembolsoUSD: number;
            motivoReembolso: string;
            referenciaReembolso: string;
        }
    ) {
        return this.db.pago.update({
            where: { id },
            data: {
                estado: EstadoPago.REEMBOLSADO,
                montoReembolsoUSD: data.montoReembolsoUSD,
                motivoReembolso: data.motivoReembolso,
                referenciaReembolso: data.referenciaReembolso,
            },
        });
    }

    // ── Bono promocional ──

    crearBonoPromocional(data: Prisma.BonoPromocionalUncheckedCreateInput) {
        return this.db.bonoPromocional.create({ data });
    }

    obtenerBonoPromocionalPorId(id: string) {
        return this.db.bonoPromocional.findUnique({ where: { id } });
    }

    listarBonosActivos(ahora: Date = new Date()) {
        return this.db.bonoPromocional.findMany({
            where: {
                activo: true,
                vigenciaInicio: { lte: ahora },
                vigenciaFin: { gte: ahora },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    /**
     * SPEC-212: listado paginado de bonos con filtro por activo/inactivo.
     */
    async listarBonos(
        filtros: { activo?: boolean | undefined },
        paginacion: PaginacionParams
    ): Promise<ResultadoPaginado<BonoPromocionalResumen>> {
        const where: Prisma.BonoPromocionalWhereInput = {};
        if (filtros.activo !== undefined) {
            where.activo = filtros.activo;
        }

        const [items, total] = await Promise.all([
            this.db.bonoPromocional.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
            }),
            this.db.bonoPromocional.count({ where }),
        ]);

        return { items, total };
    }

    actualizarBonoPromocional(id: string, data: Prisma.BonoPromocionalUncheckedUpdateInput) {
        return this.db.bonoPromocional.update({ where: { id }, data });
    }

    // ── Bono aplicado ──

    crearBonoAplicado(data: Prisma.BonoAplicadoUncheckedCreateInput) {
        return this.db.bonoAplicado.create({ data });
    }

    listarBonosAplicados(suscripcionId: string) {
        return this.db.bonoAplicado.findMany({
            where: { suscripcionId },
            orderBy: { aplicadoEn: "desc" },
        });
    }

    obtenerBonoPromocionalPorNombre(nombre: string) {
        return this.db.bonoPromocional.findUnique({ where: { nombre } });
    }

    contarBonosAplicadosPorBono(bonoId: string) {
        return this.db.bonoAplicado.count({ where: { bonoId } });
    }

    contarBonosAplicadosPorSuscripcion(suscripcionId: string, bonoId?: string) {
        return this.db.bonoAplicado.count({
            where: { suscripcionId, ...(bonoId ? { bonoId } : {}) },
        });
    }

    existeBonoAplicado(bonoId: string, suscripcionId: string) {
        return this.db.bonoAplicado
            .count({ where: { bonoId, suscripcionId } })
            .then((count) => count > 0);
    }

    // ── Suscripción (extensiones SPEC-244) ──

    /**
     * SPEC-244 (002-PI-147): true si el titular (usuario padre o colegio) tiene
     * una suscripción en estado ACTIVA, EN_GRACIA o PENDIENTE_AUTORIZACION.
     */
    async existeSuscripcionVigenteParaTitular(filtro: { usuarioId?: string | undefined; colegioId?: string | undefined }): Promise<boolean> {
        const OR: Prisma.SuscripcionWhereInput[] = [];
        if (filtro.usuarioId) OR.push({ usuarioId: filtro.usuarioId });
        if (filtro.colegioId) OR.push({ colegioId: filtro.colegioId });
        if (OR.length === 0) return false;

        const count = await this.db.suscripcion.count({
            where: {
                OR,
                estado: {
                    in: [EstadoSuscripcion.ACTIVA, EstadoSuscripcion.EN_GRACIA, EstadoSuscripcion.PENDIENTE_AUTORIZACION],
                },
            },
        });
        return count > 0;
    }

    /**
     * SPEC-244 (002-PI-147): cuenta suscripciones con origen FREEMIUM_AUTO de un
     * usuario padre (anti-doble freemium autónomo).
     */
    async contarSuscripcionesFreemiumPorUsuario(usuarioId: string): Promise<number> {
        return this.db.suscripcion.count({
            where: {
                usuarioId,
                origen: OrigenSuscripcion.FREEMIUM_AUTO,
            },
        });
    }

    // ── Código de referido ──

    crearCodigoReferidoUso(data: Prisma.CodigoReferidoUsoUncheckedCreateInput) {
        return this.db.codigoReferidoUso.create({ data });
    }

    contarReferidosExitososPorAnio(referidorId: string, anio: number) {
        return this.db.codigoReferidoUso.count({
            where: {
                codigoReferidoUsuarioId: referidorId,
                anio,
                recompensaOtorgada: true,
            },
        });
    }

    // ── Tasa de cambio ──

    crearTasaCambio(data: Prisma.TasaCambioUncheckedCreateInput) {
        return this.db.tasaCambio.create({ data });
    }

    obtenerTasaCambioMasReciente(monedaDestino: string) {
        return this.db.tasaCambio.findFirst({
            where: { monedaDestino },
            orderBy: { fecha: "desc" },
        });
    }

    /**
     * SPEC-214: tasas más recientes por moneda, con flag de desactualización (>24h).
     */
    async listarTasasVigentes(filtros: { monedaDestino?: string | undefined; umbralHoras?: number | undefined }): Promise<
        Array<{
            monedaDestino: string;
            tasa: number;
            fecha: Date;
            fuente: string;
            desactualizada: boolean;
            horasDesdeActualizacion: number;
        }>
    > {
        const umbralHoras = filtros.umbralHoras ?? 24;
        const ahora = new Date();

        const where: Prisma.TasaCambioWhereInput = {};
        if (filtros.monedaDestino) {
            where.monedaDestino = filtros.monedaDestino;
        }

        const ultimas = await this.db.tasaCambio.groupBy({
            by: ["monedaDestino"],
            where,
            _max: { fecha: true },
        });

        const resultados = await Promise.all(
            ultimas.map(async (u) => {
                const whereTasa: Prisma.TasaCambioWhereInput = { monedaDestino: u.monedaDestino };
                if (u._max.fecha) {
                    whereTasa.fecha = u._max.fecha;
                }
                const tasa = await this.db.tasaCambio.findFirst({
                    where: whereTasa,
                    orderBy: { createdAt: "desc" },
                });
                if (!tasa) return null;
                const horasDesdeActualizacion = Math.max(0, Math.floor((ahora.getTime() - tasa.fecha.getTime()) / (1000 * 60 * 60)));
                return {
                    monedaDestino: tasa.monedaDestino,
                    tasa: tasa.tasa,
                    fecha: tasa.fecha,
                    fuente: tasa.fuente,
                    desactualizada: horasDesdeActualizacion > umbralHoras,
                    horasDesdeActualizacion,
                };
            })
        );

        return resultados.filter((r): r is NonNullable<typeof r> => r !== null);
    }

    // ── Ficha cliente ──

    /**
     * SPEC-212: ficha completa de cliente/suscripción.
     */
    async obtenerFichaCliente(suscripcionId: string) {
        const [suscripcion, pagos, eventos] = await Promise.all([
            this.obtenerSuscripcionPorId(suscripcionId),
            this.listarPagosPorSuscripcion(suscripcionId),
            this.db.auditLog.findMany({
                where: {
                    OR: [
                        { recursoId: suscripcionId, tipoRecurso: "Suscripcion" },
                        { metadatos: { path: ["suscripcionId"], equals: suscripcionId } },
                    ],
                },
                orderBy: { creadoEn: "desc" },
                take: 100,
            }),
        ]);

        return { suscripcion, pagos, eventos };
    }

    // ── SPEC-245: activación manual de suscripciones ──

    /**
     * SPEC-245 (002-PI-148): usuarios PADRE y/o colegios que NO tienen una
     * suscripción en estado ACTIVA, EN_GRACIA o PENDIENTE_AUTORIZACION.
     */
    async listarSinSuscripcion(
        filtros: { tipo?: "PADRE" | "COLEGIO"; q?: string | undefined },
        paginacion: PaginacionParams
    ): Promise<ResultadoPaginado<TargetSinSuscripcion>> {
        const q = filtros.q?.trim();
        const incluirPadres = filtros.tipo !== "COLEGIO";
        const incluirColegios = filtros.tipo !== "PADRE";

        const estadosVigentes: EstadoSuscripcion[] = [
            EstadoSuscripcion.ACTIVA,
            EstadoSuscripcion.EN_GRACIA,
            EstadoSuscripcion.PENDIENTE_AUTORIZACION,
        ];

        const [idsVigentesPadre, idsVigentesColegio] = await Promise.all([
            incluirPadres
                ? this.db.suscripcion
                    .findMany({
                        where: { estado: { in: estadosVigentes }, usuarioId: { not: null } },
                        select: { usuarioId: true },
                        distinct: ["usuarioId"],
                    })
                    .then((rows) => rows.map((r) => r.usuarioId).filter((id): id is string => id !== null))
                : Promise.resolve([]),
            incluirColegios
                ? this.db.suscripcion
                    .findMany({
                        where: { estado: { in: estadosVigentes }, colegioId: { not: null } },
                        select: { colegioId: true },
                        distinct: ["colegioId"],
                    })
                    .then((rows) => rows.map((r) => r.colegioId).filter((id): id is string => id !== null))
                : Promise.resolve([]),
        ]);

        const wherePadre: Prisma.UsuarioWhereInput = { rol: RolUsuario.PARENT };
        if (q) {
            wherePadre.OR = [
                { nombre: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
            ];
        }
        if (idsVigentesPadre.length > 0) {
            wherePadre.id = { notIn: idsVigentesPadre };
        }

        const whereColegio: Prisma.ColegioWhereInput = {};
        if (q) {
            whereColegio.OR = [
                { nombre: { contains: q, mode: "insensitive" } },
                { representanteLegalEmail: { contains: q, mode: "insensitive" } },
                { representanteLegalIdentificacion: { contains: q, mode: "insensitive" } },
            ];
        }
        if (idsVigentesColegio.length > 0) {
            whereColegio.id = { notIn: idsVigentesColegio };
        }

        const [padres, colegios, totalPadres, totalColegios] = await Promise.all([
            incluirPadres
                ? this.db.usuario.findMany({
                    where: wherePadre,
                    select: { id: true, nombre: true, email: true },
                    orderBy: { email: "asc" },
                })
                : Promise.resolve([]),
            incluirColegios
                ? this.db.colegio.findMany({
                    where: whereColegio,
                    select: {
                        id: true,
                        nombre: true,
                        representanteLegalEmail: true,
                        representanteLegalIdentificacion: true,
                    },
                    orderBy: { nombre: "asc" },
                })
                : Promise.resolve([]),
            incluirPadres ? this.db.usuario.count({ where: wherePadre }) : Promise.resolve(0),
            incluirColegios ? this.db.colegio.count({ where: whereColegio }) : Promise.resolve(0),
        ]);

        const targetsPadre: TargetSinSuscripcion[] = padres.map((u) => ({
            id: u.id,
            tipo: "PADRE",
            nombre: u.nombre,
            email: u.email,
            identificacion: null,
        }));
        const targetsColegio: TargetSinSuscripcion[] = colegios.map((c) => ({
            id: c.id,
            tipo: "COLEGIO",
            nombre: c.nombre,
            email: c.representanteLegalEmail,
            identificacion: c.representanteLegalIdentificacion,
        }));

        const merged = [...targetsPadre, ...targetsColegio].sort((a, b) => {
            const nombreA = (a.nombre ?? a.email).toLowerCase();
            const nombreB = (b.nombre ?? b.email).toLowerCase();
            return nombreA.localeCompare(nombreB);
        });

        const items = merged.slice(paginacion.skip, paginacion.skip + paginacion.take);
        return { items, total: totalPadres + totalColegios };
    }

    /**
     * SPEC-245 (002-PI-148): suscripciones en PENDIENTE_AUTORIZACION con plan y titular.
     */
    async listarSolicitudesPendientes(
        filtros: { q?: string | undefined },
        paginacion: PaginacionParams
    ): Promise<ResultadoPaginado<SuscripcionConPlanYTitular>> {
        const where: Prisma.SuscripcionWhereInput = {
            estado: EstadoSuscripcion.PENDIENTE_AUTORIZACION,
        };
        if (filtros.q) {
            const query = filtros.q.trim();
            where.OR = [
                { colegio: { nombre: { contains: query, mode: "insensitive" } } },
                { usuario: { nombre: { contains: query, mode: "insensitive" } } },
                { usuario: { email: { contains: query, mode: "insensitive" } } },
            ];
        }

        const [items, total] = await Promise.all([
            this.db.suscripcion.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: paginacion.skip,
                take: paginacion.take,
                include: {
                    planActual: true,
                    colegio: { select: { id: true, nombre: true } },
                    usuario: { select: { id: true, nombre: true, email: true } },
                },
            }),
            this.db.suscripcion.count({ where }),
        ]);

        return { items, total };
    }

}
