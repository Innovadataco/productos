/**
 * SPEC-225 (002-PI-126): repositorio DAL del detector de anomalías
 * dinero-vs-valor. Aísla TODO el acceso a Prisma del dominio (frontera Q-3):
 * las reglas (`src/lib/analisis/anomalias/reglas/`), el detector, el servicio
 * de resolución y las rutas admin consumen esta clase; fuera de aquí nadie
 * importa `@/lib/prisma` para este dominio.
 *
 * Regla de oro del módulo: solo conteos, sumas e ids internos. NUNCA se lee
 * `Reporte.texto` ni datos de menores/PII (FR-008, Ley 1581).
 */
import type { DuracionPlan, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import { withUnitOfWork } from "../unit-of-work";

/** Pago autorizado mínimo para la regla de mora y puntualidad histórica. */
export interface PagoPuntualidad {
    duracionCubierta: DuracionPlan;
    fechaReporte: Date;
    fechaAutorizacion: Date | null;
}

/** Suscripción candidata a mora anómala con su historial de pagos autorizados. */
export interface SuscripcionMora {
    id: string;
    tipoTitular: string;
    colegioId: string | null;
    estado: string;
    fechaInicio: Date;
    fechaFin: Date;
    pagos: PagoPuntualidad[];
}

/** Alta de suscripción con su ciudad (solo titular COLEGIO tiene ciudad en v1). */
export interface AltaConCiudad {
    id: string;
    createdAt: Date;
    colegio: { ciudadId: string; ciudad: { nombre: string } } | null;
}

/** Cancelación reciente de titular colegio. */
export interface CancelacionColegio {
    id: string;
    canceladaEn: Date | null;
    colegio: { id: string; nombre: string; tenantId: string } | null;
}

/** Pago autorizado con ciudad del titular (para recaudo semanal por ciudad). */
export interface PagoConCiudad {
    montoNetoUSD: number;
    suscripcion: { colegio: { ciudadId: string; ciudad: { nombre: string } } | null };
}

/** Datos de creación de una anomalía (agregados, sin PII). */
export interface NuevaAnomalia {
    tipo: string;
    sujetoTipo: string | null;
    sujetoId: string | null;
    severidad: string;
    descripcion: string;
    datosContexto: Prisma.InputJsonValue;
}

export class AnomaliaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    // ── Lecturas de las 6 reglas ─────────────────────────────────────────

    /**
     * Regla mora: suscripciones ACTIVA/EN_GRACIA con `fechaFin` vencida en o
     * antes de `fechaFinLimite` (= ahora − umbralMedia días), con sus pagos
     * AUTORIZADO ordenados por reporte (puntualidad histórica, H-6).
     */
    listarSuscripcionesVencidasConPagos(fechaFinLimite: Date): Promise<SuscripcionMora[]> {
        return this.db.suscripcion.findMany({
            where: {
                estado: { in: ["ACTIVA", "EN_GRACIA"] },
                fechaFin: { lte: fechaFinLimite },
            },
            select: {
                id: true,
                tipoTitular: true,
                colegioId: true,
                estado: true,
                fechaInicio: true,
                fechaFin: true,
                pagos: {
                    where: { estado: "AUTORIZADO" },
                    orderBy: { fechaReporte: "asc" },
                    select: {
                        duracionCubierta: true,
                        fechaReporte: true,
                        fechaAutorizacion: true,
                    },
                },
            },
        });
    }

    /** Regla crecimiento: altas (createdAt) en el rango `[desde, hasta)` con su ciudad. */
    listarAltasPorSemana(desde: Date, hasta: Date): Promise<AltaConCiudad[]> {
        return this.db.suscripcion.findMany({
            where: { createdAt: { gte: desde, lt: hasta } },
            select: {
                id: true,
                createdAt: true,
                colegio: { select: { ciudadId: true, ciudad: { select: { nombre: true } } } },
            },
        });
    }

    /** Regla uso caído: sesiones por tenant en el rango `[desde, hasta)`. */
    async contarSesionesPorTenant(
        desde: Date,
        hasta: Date
    ): Promise<{ tenantId: string; total: number }[]> {
        const filas = await this.db.sesionLog.groupBy({
            by: ["tenantId"],
            where: { tenantId: { not: null }, iniciadaEn: { gte: desde, lt: hasta } },
            _count: { _all: true },
        });
        return filas
            .filter((f): f is typeof f & { tenantId: string } => f.tenantId !== null)
            .map((f) => ({ tenantId: f.tenantId, total: f._count._all }));
    }

    /** Colegios por tenantId (uso caído: mapear tenant → colegio para el sujeto). */
    listarColegiosPorTenant(
        tenantIds: string[]
    ): Promise<{ id: string; nombre: string; tenantId: string }[]> {
        return this.db.colegio.findMany({
            where: { tenantId: { in: tenantIds } },
            select: { id: true, nombre: true, tenantId: true },
        });
    }

    /** Regla cancelación colegio grande: cancelaciones con `canceladaEn >= desde`. */
    listarCancelacionesRecientes(desde: Date): Promise<CancelacionColegio[]> {
        return this.db.suscripcion.findMany({
            where: { canceladaEn: { gte: desde }, colegioId: { not: null } },
            select: {
                id: true,
                canceladaEn: true,
                colegio: { select: { id: true, nombre: true, tenantId: true } },
            },
        });
    }

    /** Conteo histórico de filas `Reporte` por tenant (NUNCA se lee el texto). */
    async contarReportesPorTenant(
        tenantIds: string[]
    ): Promise<Map<string, number>> {
        if (tenantIds.length === 0) return new Map();
        const filas = await this.db.reporte.groupBy({
            by: ["tenantId"],
            where: { tenantId: { in: tenantIds } },
            _count: { _all: true },
        });
        return new Map(
            filas
                .filter((f): f is typeof f & { tenantId: string } => f.tenantId !== null)
                .map((f) => [f.tenantId, f._count._all])
        );
    }

    /** Regla caída de recaudo: pagos AUTORIZADO con `fechaAutorizacion` en el rango. */
    listarPagosAutorizadosPorSemana(desde: Date, hasta: Date): Promise<PagoConCiudad[]> {
        return this.db.pago.findMany({
            where: {
                estado: "AUTORIZADO",
                fechaAutorizacion: { gte: desde, lt: hasta },
            },
            select: {
                montoNetoUSD: true,
                suscripcion: {
                    select: {
                        colegio: {
                            select: { ciudadId: true, ciudad: { select: { nombre: true } } },
                        },
                    },
                },
            },
        });
    }

    /** Regla cancelaciones masivas: total de cancelaciones con `canceladaEn >= desde`. */
    contarCancelacionesDesde(desde: Date): Promise<number> {
        return this.db.suscripcion.count({ where: { canceladaEn: { gte: desde } } });
    }

    // ── Deduplicación + persistencia ─────────────────────────────────────

    /** ¿Existe una anomalía ABIERTA del mismo (tipo, sujetoTipo, sujetoId)? (FR-007) */
    async existeAnomaliaAbierta(
        tipo: string,
        sujetoTipo: string | null,
        sujetoId: string | null
    ): Promise<boolean> {
        const existente = await this.db.anomalia.findFirst({
            where: { tipo, sujetoTipo, sujetoId, resueltaEn: null },
            select: { id: true },
        });
        return existente !== null;
    }

    /**
     * Persiste la anomalía en su propia transacción, verificando la
     * deduplicación DENTRO de la tx (findFirst + create atómico). Devuelve la
     * fila creada, o `null` si ya existía una abierta del mismo tipo+sujeto.
     */
    async crearSiNoExisteAbierta(data: NuevaAnomalia) {
        return withUnitOfWork(async (tx) => {
            const existente = await tx.anomalia.findFirst({
                where: {
                    tipo: data.tipo,
                    sujetoTipo: data.sujetoTipo,
                    sujetoId: data.sujetoId,
                    resueltaEn: null,
                },
                select: { id: true },
            });
            if (existente) return null;
            return tx.anomalia.create({
                data: {
                    tipo: data.tipo,
                    sujetoTipo: data.sujetoTipo,
                    sujetoId: data.sujetoId,
                    severidad: data.severidad,
                    descripcion: data.descripcion,
                    datosContexto: data.datosContexto,
                },
            });
        });
    }

    // ── Alertas ──────────────────────────────────────────────────────────

    /** Usuarios ADMIN activos (destinatarios de la alerta inmediata al CEO). */
    listarAdminsActivos(): Promise<{ id: string }[]> {
        return this.db.usuario.findMany({
            where: { rol: "ADMIN", estado: "activo" },
            select: { id: true },
        });
    }

    // ── API admin (US3) ──────────────────────────────────────────────────

    /** Lista paginada ordenada por `detectadaEn` desc (FR-012). */
    async listarAnomalias(
        where: Prisma.AnomaliaWhereInput,
        page: number,
        pageSize: number
    ) {
        const [items, total] = await Promise.all([
            this.db.anomalia.findMany({
                where,
                orderBy: { detectadaEn: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.db.anomalia.count({ where }),
        ]);
        return { items, total };
    }

    obtenerAnomalia(id: string) {
        return this.db.anomalia.findUnique({ where: { id } });
    }

    /**
     * Marca la anomalía como resuelta (FR-014). `datosContexto` llega ya con
     * el merge aditivo aplicado por el servicio (notaResolucion opcional, H-8).
     */
    marcarResuelta(id: string, adminId: string, datosContexto: Prisma.InputJsonValue) {
        return this.db.anomalia.update({
            where: { id },
            data: {
                resueltaEn: new Date(),
                resueltaPorAdminId: adminId,
                datosContexto,
            },
        });
    }
}
