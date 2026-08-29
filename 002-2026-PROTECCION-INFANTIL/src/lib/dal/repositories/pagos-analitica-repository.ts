/**
 * SPEC-218 (002-PI-118): repositorio DAL de la analítica dinero-vs-valor del
 * Módulo Pagos. Vive aparte de `PagosRepository` por el techo de 500 líneas
 * (E-8): son las queries agregadas de los 4 widgets y la fila de KPIs
 * (FR-003/FR-004), cada una en una sola query o agregados paralelos; sin N+1
 * (FR-005).
 */
import type { Prisma } from "@prisma/client";
import { TipoTitular, EstadoPago, EstadoSuscripcion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

const ESTADOS_CAIDOS: EstadoSuscripcion[] = [EstadoSuscripcion.SUSPENDIDA, EstadoSuscripcion.CANCELADA];

/** Include común del titular (colegio o padre) de una suscripción. */
const INCLUDE_TITULAR = {
    colegio: { select: { id: true, nombre: true } },
    usuario: { select: { id: true, nombre: true, email: true } },
} as const;

export class PagosAnaliticaRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Widget 1: suscripciones ACTIVA cuyo fin cae dentro de la ventana [desde, hasta]. */
    listarSuscripcionesVencenEntre(desdeUtc: Date, hastaUtc: Date) {
        return this.db.suscripcion.findMany({
            where: {
                estado: EstadoSuscripcion.ACTIVA,
                fechaFin: { gte: desdeUtc, lte: hastaUtc },
            },
            orderBy: { fechaFin: "asc" },
            take: 50,
            include: INCLUDE_TITULAR,
        });
    }

    /** Widget 2: EN_GRACIA/SUSPENDIDA con fechaFin ya superada hace al menos N días (el límite lo calcula el servicio). */
    listarMoraLargaAntesDe(fechaFinLimiteUtc: Date) {
        return this.db.suscripcion.findMany({
            where: {
                estado: { in: [EstadoSuscripcion.EN_GRACIA, EstadoSuscripcion.SUSPENDIDA] },
                fechaFin: { lte: fechaFinLimiteUtc },
            },
            // Más antigua primero = más días de mora primero.
            orderBy: { fechaFin: "asc" },
            take: 50,
            include: INCLUDE_TITULAR,
        });
    }

    /**
     * Widget 3: padres con suscripción ACTIVA cuyo colegio vinculado tiene la
     * suscripción institucional SUSPENDIDA o CANCELADA. La vinculación
     * padre↔colegio usa la relación explícita por tenant (Usuario.tenantId =
     * Colegio.tenantId); NO el fallback por dominio de email (deuda del BRIEF).
     */
    listarPadresPagantesColegiosNoRenovados() {
        return this.db.suscripcion.findMany({
            where: {
                tipoTitular: TipoTitular.PADRE,
                estado: EstadoSuscripcion.ACTIVA,
                usuario: {
                    tenant: {
                        colegio: {
                            suscripciones: {
                                some: { tipoTitular: TipoTitular.COLEGIO, estado: { in: ESTADOS_CAIDOS } },
                            },
                        },
                    },
                },
            },
            take: 50,
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombre: true,
                        email: true,
                        tenant: {
                            select: {
                                colegio: {
                                    select: {
                                        id: true,
                                        nombre: true,
                                        representanteLegalNombre: true,
                                        representanteLegalEmail: true,
                                        suscripciones: {
                                            where: { tipoTitular: TipoTitular.COLEGIO, estado: { in: ESTADOS_CAIDOS } },
                                            orderBy: { updatedAt: "desc" },
                                            take: 1,
                                            select: { estado: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
    }

    /** Widget 4: altas (país + fecha) desde un corte, para agrupar por mes Bogotá en el servicio. */
    listarAltasPorPaisDesde(desdeUtc: Date) {
        return this.db.suscripcion.findMany({
            where: { createdAt: { gte: desdeUtc } },
            select: { paisCliente: true, createdAt: true },
        });
    }

    /**
     * Fila de KPIs (BRIEF §9.2): recaudo mes actual/anterior en USD, conteos por
     * estado, altas y renovaciones del mes, ticket promedio, LTV (recaudo
     * histórico / suscripciones que han pagado), base freemium y referidos.
     * Los porcentajes se derivan en el servicio.
     */
    async obtenerKpiAnalitica(rangos: {
        mesActual: { inicio: Date; fin: Date };
        mesAnterior: { inicio: Date; fin: Date };
    }) {
        const { mesActual, mesAnterior } = rangos;
        const wherePagosMesActual: Prisma.PagoWhereInput = {
            estado: EstadoPago.AUTORIZADO,
            createdAt: { gte: mesActual.inicio, lt: mesActual.fin },
        };

        const [
            recaudoActual,
            recaudoAnterior,
            porEstado,
            nuevasMes,
            renovacionesMes,
            ticketMes,
            recaudoTotal,
            pagantes,
            freemiumTotal,
            freemiumConvertidas,
            conReferido,
            totalSuscripciones,
        ] = await Promise.all([
            this.db.pago.aggregate({ _sum: { montoNetoUSD: true }, where: wherePagosMesActual }),
            this.db.pago.aggregate({
                _sum: { montoNetoUSD: true },
                where: { estado: EstadoPago.AUTORIZADO, createdAt: { gte: mesAnterior.inicio, lt: mesAnterior.fin } },
            }),
            this.db.suscripcion.groupBy({ by: ["estado"], _count: { _all: true } }),
            this.db.suscripcion.count({ where: { createdAt: { gte: mesActual.inicio, lt: mesActual.fin } } }),
            this.db.pago.count({
                where: {
                    estado: EstadoPago.AUTORIZADO,
                    createdAt: { gte: mesActual.inicio, lt: mesActual.fin },
                    suscripcion: { createdAt: { lt: mesActual.inicio } },
                },
            }),
            this.db.pago.aggregate({ _avg: { montoNetoUSD: true }, where: wherePagosMesActual }),
            this.db.pago.aggregate({ _sum: { montoNetoUSD: true }, where: { estado: EstadoPago.AUTORIZADO } }),
            this.db.pago.groupBy({ by: ["suscripcionId"], where: { estado: EstadoPago.AUTORIZADO } }),
            this.db.suscripcion.count({ where: { esFreemium: true } }),
            this.db.suscripcion.count({ where: { esFreemium: true, pagos: { some: { estado: EstadoPago.AUTORIZADO } } } }),
            this.db.suscripcion.count({ where: { codigoReferidoUsado: { not: null } } }),
            this.db.suscripcion.count(),
        ]);

        return {
            recaudoMesActualUSD: recaudoActual._sum.montoNetoUSD ?? 0,
            recaudoMesAnteriorUSD: recaudoAnterior._sum.montoNetoUSD ?? 0,
            conteoPorEstado: porEstado.map((g) => ({ estado: g.estado, total: g._count._all })),
            nuevasEsteMes: nuevasMes,
            renovacionesEsteMes: renovacionesMes,
            ticketPromedioMesUSD: ticketMes._avg.montoNetoUSD,
            recaudoTotalUSD: recaudoTotal._sum.montoNetoUSD ?? 0,
            suscripcionesPagantes: pagantes.length,
            freemiumTotal,
            freemiumConvertidas,
            conCodigoReferido: conReferido,
            totalSuscripciones,
        };
    }
}
