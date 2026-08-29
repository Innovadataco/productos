/**
 * SPEC-222 (002-PI-123): repositorio DAL del panel principal Análisis
 * (Dinero vs Valor). Aísla TODO el acceso a Prisma del dominio (frontera
 * Q-3): el servicio `src/lib/dal/services/analisis-panel.ts` y las rutas
 * `src/app/api/admin/analisis/**` lo consumen; fuera de aquí nadie importa
 * `@/lib/prisma` para este dominio.
 *
 * Agregados exclusivamente comerciales (suscripciones, pagos, sesiones,
 * scores, recomendaciones, anomalías): ninguna query toca texto de reportes,
 * identificadores de menores ni datos de denunciantes (FR-015). La query base
 * es UN `findMany` con includes tipados (sin N+1); la variación de recaudo es
 * UN `groupBy` agregado adicional.
 */
import type { Anomalia, Prisma, Recomendacion } from "@prisma/client";
import { EstadoPago, EstadoSuscripcion, TipoTitular } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

/** Filtros de nivel activos del drill-down y globales del panel. */
export interface FiltrosPanel {
    estado?: EstadoSuscripcion | undefined;
    tipoTitular?: TipoTitular | undefined;
    paisId?: string | undefined;
    ciudadId?: string | undefined;
    colegioId?: string | undefined;
}

export interface RangoUtc {
    desde: Date;
    hasta: Date;
}

/** Fila base de la agregación: una suscripción con sus métricas del período. */
export type SuscripcionBasePanel = Prisma.SuscripcionGetPayload<{
    select: typeof SELECT_BASE_PANEL & typeof SELECT_METRICAS_PERIODO;
}>;

/** Métricas del período incluidas en la query base (el `where` de pagos lo fija el rango). */
const SELECT_METRICAS_PERIODO = {
    pagos: { select: { montoNetoUSD: true } },
    scoreClientes: { select: { scoreTotal: true }, take: 1 },
    bonosAplicados: { select: { id: true }, take: 1 },
} as const;

const SELECT_BASE_PANEL = {
    id: true,
    tipoTitular: true,
    estado: true,
    fechaInicio: true,
    esFreemium: true,
    codigoReferidoUsado: true,
    paisCliente: true,
    colegioId: true,
    usuarioId: true,
    canceladaEn: true,
    colegio: {
        select: {
            id: true,
            nombre: true,
            paisId: true,
            ciudadId: true,
            pais: { select: { id: true, nombre: true, codigo: true } },
            ciudad: { select: { id: true, nombre: true } },
        },
    },
    usuario: { select: { id: true, nombre: true } },
    planActual: { select: { id: true, nombre: true, duracion: true, tipoTitular: true, precioBaseUSD: true } },
    _count: { select: { pagos: { where: { estado: EstadoPago.AUTORIZADO } } } },
} as const;

/** Filtro de pagos AUTORIZADO cuya fecha efectiva cae en el rango. */
function pagosEnRango(rango: RangoUtc): Prisma.PagoWhereInput {
    // Fecha efectiva = fechaAutorizacion; si el pago aún no la tiene (dato
    // semilla o legado), se usa createdAt como respaldo.
    return {
        estado: EstadoPago.AUTORIZADO,
        OR: [
            { fechaAutorizacion: { gte: rango.desde, lt: rango.hasta } },
            { fechaAutorizacion: null, createdAt: { gte: rango.desde, lt: rango.hasta } },
        ],
    };
}

export class AnalisisPanelRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /** Top 5: recomendaciones PENDIENTE no expiradas (FR-003). */
    listarTopDecisiones(ahora: Date): Promise<Recomendacion[]> {
        return this.db.recomendacion.findMany({
            where: { estado: "PENDIENTE", expiraEn: { gt: ahora } },
            orderBy: [{ prioridad: "desc" }, { generadaEn: "asc" }],
            take: 5,
        });
    }

    /**
     * Base de suscripciones del período con métricas incluidas (UNA query,
     * includes tipados; Prisma las resuelve sin N+1). Incluye pagos
     * autorizados del rango y el snapshot de score del período.
     */
    listarBaseSuscripciones(filtros: FiltrosPanel, rango: RangoUtc, periodoScore: string) {
        const where: Prisma.SuscripcionWhereInput = {
            // Existían dentro del período analizado.
            fechaInicio: { lt: rango.hasta },
            ...(filtros.estado ? { estado: filtros.estado } : {}),
            ...(filtros.tipoTitular ? { tipoTitular: filtros.tipoTitular } : {}),
            ...(filtros.colegioId ? { colegioId: filtros.colegioId } : {}),
            ...(filtros.paisId || filtros.ciudadId
                ? {
                    OR: [
                        // Titulares COLEGIO: geografía por la relación del colegio.
                        {
                            colegio: {
                                ...(filtros.paisId ? { paisId: filtros.paisId } : {}),
                                ...(filtros.ciudadId ? { ciudadId: filtros.ciudadId } : {}),
                            },
                        },
                        // Titulares PADRE: sin geografía relacional; se
                        // conservan y caen en el bucket "Sin ciudad" (su
                        // única geografía es `paisCliente`, validada en el
                        // servicio cuando hay filtro de país).
                        { tipoTitular: TipoTitular.PADRE },
                    ],
                }
                : {}),
        };
        return this.db.suscripcion.findMany({
            where,
            select: {
                ...SELECT_BASE_PANEL,
                pagos: {
                    where: pagosEnRango(rango),
                    select: { montoNetoUSD: true },
                },
                scoreClientes: {
                    where: { periodo: periodoScore },
                    select: { scoreTotal: true },
                    take: 1,
                },
                bonosAplicados: { select: { id: true }, take: 1 },
            },
        });
    }

    /**
     * Recaudo por suscripción en un rango arbitrario (UN groupBy agregado) —
     * alimenta la variación vs período anterior.
     */
    async sumarRecaudoPorSuscripcion(suscripcionIds: string[], rango: RangoUtc): Promise<Map<string, number>> {
        if (suscripcionIds.length === 0) return new Map();
        const filas = await this.db.pago.groupBy({
            by: ["suscripcionId"],
            where: { suscripcionId: { in: suscripcionIds }, ...pagosEnRango(rango) },
            _sum: { montoNetoUSD: true },
        });
        return new Map(filas.map((f) => [f.suscripcionId, f._sum.montoNetoUSD ?? 0]));
    }

    /** Código ISO del país (para contrastar `paisCliente` de padres en drill). */
    async obtenerCodigoPais(paisId: string): Promise<string | null> {
        const pais = await this.db.pais.findUnique({ where: { id: paisId }, select: { codigo: true } });
        return pais?.codigo ?? null;
    }

    /** País de una ciudad (para el breadcrumb y el bucket "Sin ciudad"). */
    async obtenerCiudadConPais(ciudadId: string): Promise<{ nombre: string; paisId: string } | null> {
        return this.db.ciudad.findUnique({ where: { id: ciudadId }, select: { nombre: true, paisId: true } });
    }

    /** Nombre de un colegio (breadcrumb del drill). */
    async obtenerNombreColegio(colegioId: string): Promise<string | null> {
        const colegio = await this.db.colegio.findUnique({ where: { id: colegioId }, select: { nombre: true } });
        return colegio?.nombre ?? null;
    }

    /** Nombre de un país (breadcrumb del drill). */
    async obtenerNombrePais(paisId: string): Promise<string | null> {
        const pais = await this.db.pais.findUnique({ where: { id: paisId }, select: { nombre: true } });
        return pais?.nombre ?? null;
    }

    /**
     * Anomalías no resueltas. Si la tabla aún no existe en el entorno
     * (SPEC-225 pendiente), devuelve null en lugar de lanzar (FR-010).
     */
    async listarAnomaliasNoResueltas(severidad?: "ALTA" | "MEDIA" | "BAJA"): Promise<Anomalia[] | null> {
        try {
            return await this.db.anomalia.findMany({
                where: { resueltaEn: null, ...(severidad ? { severidad } : {}) },
                orderBy: { detectadaEn: "desc" },
            });
        } catch (error) {
            if (esErrorTablaAusente(error)) {
                console.warn("[AnalisisPanel] Anomalias no disponibles — SPEC-225 pendiente o tabla ausente");
                return null;
            }
            throw error;
        }
    }

    // ── KPIs ────────────────────────────────────────────────────────────────

    /** MAU: usuarios distintos con actividad en el rango (SPEC-206). */
    async contarMau(rango: RangoUtc): Promise<number> {
        const grupos = await this.db.sesionLog.groupBy({
            by: ["usuarioId"],
            where: { ultimaActividadEn: { gte: rango.desde, lt: rango.hasta } },
        });
        return grupos.length;
    }

    /** Suscripciones ACTIVA con su plan (base del MRR). */
    listarSuscripcionesActivasConPlan() {
        return this.db.suscripcion.findMany({
            where: { estado: EstadoSuscripcion.ACTIVA },
            select: {
                id: true,
                fechaInicio: true,
                planActual: { select: { precioBaseUSD: true, duracion: true } },
            },
        });
    }

    /** Canceladas dentro del rango (numerador del churn). */
    contarCanceladas(rango: RangoUtc): Promise<number> {
        return this.db.suscripcion.count({
            where: { estado: EstadoSuscripcion.CANCELADA, canceladaEn: { gte: rango.desde, lt: rango.hasta } },
        });
    }

    /**
     * Activas al inicio del período (denominador del churn): ya habían
     * empezado y no estaban canceladas antes del inicio.
     */
    contarActivasAlInicio(inicio: Date): Promise<number> {
        return this.db.suscripcion.count({
            where: {
                fechaInicio: { lt: inicio },
                OR: [{ canceladaEn: null }, { canceladaEn: { gte: inicio } }],
            },
        });
    }

    /** Recaudo histórico por suscripción (base del LTV); `hasta` acota el corte temporal. */
    async sumarRecaudoHistoricoPorSuscripcion(hasta?: Date): Promise<number[]> {
        const filas = await this.db.pago.groupBy({
            by: ["suscripcionId"],
            where: { estado: EstadoPago.AUTORIZADO, ...(hasta ? { createdAt: { lt: hasta } } : {}) },
            _sum: { montoNetoUSD: true },
        });
        return filas.map((f) => f._sum.montoNetoUSD ?? 0);
    }

    /** Pagos autorizados del rango (base del % renovaciones). */
    listarPagosAutorizados(rango: RangoUtc) {
        return this.db.pago.findMany({
            where: pagosEnRango(rango),
            select: { id: true, suscripcionId: true, createdAt: true, fechaAutorizacion: true },
        });
    }

    /** Primer pago autorizado (createdAt mínimo) por suscripción. */
    async primerPagoAutorizadoPorSuscripcion(): Promise<Map<string, Date>> {
        const filas = await this.db.pago.groupBy({
            by: ["suscripcionId"],
            where: { estado: EstadoPago.AUTORIZADO },
            _min: { createdAt: true },
        });
        const mapa = new Map<string, Date>();
        for (const f of filas) {
            if (f._min.createdAt) mapa.set(f.suscripcionId, f._min.createdAt);
        }
        return mapa;
    }

    /** Total de suscripciones freemium (denominador de la conversión). */
    contarFreemium(): Promise<number> {
        return this.db.suscripcion.count({ where: { esFreemium: true } });
    }

    /** Freemium con al menos un pago autorizado (convertidas). */
    async contarFreemiumConvertidas(): Promise<number> {
        const filas = await this.db.suscripcion.findMany({
            where: { esFreemium: true, pagos: { some: { estado: EstadoPago.AUTORIZADO } } },
            select: { id: true },
        });
        return filas.length;
    }

    /**
     * Usos de código de referido: total registrados y activados en el rango
     * (% referidos exitosos del período y de su anterior para el delta).
     */
    async contarReferidos(rango: RangoUtc): Promise<{ total: number; activados: number }> {
        const ventana = { gte: rango.desde, lt: rango.hasta };
        const [total, activados] = await Promise.all([
            this.db.codigoReferidoUso.count({ where: { fechaRegistro: ventana } }),
            this.db.codigoReferidoUso.count({ where: { fechaActivacion: ventana } }),
        ]);
        return { total, activados };
    }
}

function esErrorTablaAusente(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        ((error as { code?: unknown }).code === "P2021" || (error as { code?: unknown }).code === "P2022")
    );
}
