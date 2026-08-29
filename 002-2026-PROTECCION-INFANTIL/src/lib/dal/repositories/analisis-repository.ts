/**
 * SPEC-220 (002-PI-121): repositorio DAL del dominio Análisis.
 * Aísla TODO el acceso a Prisma del dominio (frontera Q-3): la UI (ficha de
 * cliente del módulo Pagos) y el servicio `src/lib/analisis/score.ts` consumen
 * esta clase; fuera de aquí nadie importa `@/lib/prisma` para este dominio.
 * Solo conteos agregados y snapshots: nunca texto de reportes ni PII.
 */
import type { DigestSemanal, Prisma, ScoreCliente } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";
import { periodoActualBogota } from "@/lib/analisis/periodos";

export interface ScoreClienteVista {
    periodo: string;
    scoreTotal: number;
    componentes: { reportes: number; casos: number; alertas: number; sesiones: number };
    pesos: { reportes: number; casos: number; alertas: number; sesiones: number };
    percentilEnCohorte: number | null;
    calculadoEn: Date;
}

// ── SPEC-223 (002-PI-124): tipos del digest semanal ──────────────────────────

/** KPIs crudos de una ventana semanal (ver `kpisVentana`). */
export interface KpisVentanaCrudos {
    recaudoUSD: number;
    recaudoCOP: number;
    nuevas: number;
    canceladas: number;
    activasAlInicio: number;
}

export interface DecisionTopDigest {
    titulo: string;
    descripcion: string;
    accionSugerida: string | null;
}

export interface ScoreClienteDigest {
    nombre: string;
    scoreTotal: number;
}

export interface AnomaliaDigest {
    severidad: string;
    descripcion: string;
}

export interface DestinatarioAdminDigest {
    id: string;
    email: string;
}

/** Contenido agregado persistido en `DigestSemanal` (nunca PII ni textos). */
export interface DatosDigestUpsert {
    periodo: string;
    destinatarioId: string;
    top5Decisiones: unknown;
    kpisSemana: unknown;
    kpisVsPrevia: unknown;
    enlacePanel: string;
}

export interface ScoreClienteConHistorico {
    /** Snapshot del período actual (mes calendario Bogotá); null si el job aún no corrió. */
    actual: ScoreClienteVista | null;
    /** Últimos 12 períodos (incluye el actual si existe), del más reciente al más antiguo. */
    historico: ScoreClienteVista[];
}

/** Rango `[desde, hasta)` en instantes UTC de un período "YYYY-MM" Bogotá. */
export interface RangoPeriodo {
    desde: Date;
    hasta: Date;
}

/** Conteos del período de los 4 componentes del score de valor. */
export interface ComponentesScore {
    reportes: number;
    casos: number;
    alertas: number;
    sesiones: number;
}

export type SuscripcionConColegio = Prisma.SuscripcionGetPayload<{ include: { colegio: true } }>;

const COMPONENTES_EN_CERO: ComponentesScore = { reportes: 0, casos: 0, alertas: 0, sesiones: 0 };

function aVista(fila: ScoreCliente): ScoreClienteVista {
    return {
        periodo: fila.periodo,
        scoreTotal: fila.scoreTotal,
        componentes: {
            reportes: fila.componenteReportes,
            casos: fila.componenteCasos,
            alertas: fila.componenteAlertas,
            sesiones: fila.componenteSesiones,
        },
        pesos: {
            reportes: fila.pesoReportes,
            casos: fila.pesoCasos,
            alertas: fila.pesoAlertas,
            sesiones: fila.pesoSesiones,
        },
        percentilEnCohorte: fila.percentilEnCohorte,
        calculadoEn: fila.calculadoEn,
    };
}

export class AnalisisRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * FR-012: snapshot del período actual + histórico de hasta 12 períodos en
     * orden descendente para la card "Score de valor" de la ficha de cliente.
     */
    async obtenerScoreCliente(suscripcionId: string): Promise<ScoreClienteConHistorico> {
        const periodoActual = periodoActualBogota();
        const filas = await this.db.scoreCliente.findMany({
            where: { suscripcionId },
            orderBy: { periodo: "desc" },
            take: 12,
        });
        const historico = filas.map(aVista);
        const actual = historico.find((v) => v.periodo === periodoActual) ?? null;
        return { actual, historico };
    }

    /** Suscripciones con actividad comercial vigente (ACTIVA/EN_GRACIA) y su colegio. */
    listarSuscripcionesVigentes(): Promise<SuscripcionConColegio[]> {
        return this.db.suscripcion.findMany({
            where: { estado: { in: ["ACTIVA", "EN_GRACIA"] } },
            include: { colegio: true },
        });
    }

    /**
     * Conteos del período para titular COLEGIO: reportes del tenant
     * (`eliminado = false`), casos (`SeguimientoCaso`), alertas (`AlertaColegio`)
     * y sesiones del tenant (`SesionLog.tenantId`; las de `tenantId = null` no
     * se atribuyen a ningún colegio).
     */
    async contarComponentesColegio(
        colegioId: string,
        tenantId: string,
        rango: RangoPeriodo
    ): Promise<ComponentesScore> {
        const ventana = { gte: rango.desde, lt: rango.hasta };
        const [reportes, casos, alertas, sesiones] = await Promise.all([
            this.db.reporte.count({
                where: { tenantId, eliminado: false, creadoEn: ventana },
            }),
            this.db.seguimientoCaso.count({ where: { colegioId, creadoEn: ventana } }),
            this.db.alertaColegio.count({ where: { colegioId, creadoEn: ventana } }),
            this.db.sesionLog.count({ where: { tenantId, iniciadaEn: ventana } }),
        ]);
        return { reportes, casos, alertas, sesiones };
    }

    /**
     * Conteos del período para titular PADRE: reportes del usuario, expedientes
     * abiertos en el período y sesiones del usuario. Sin fuente de alertas para
     * padre en v1 → `alertas = 0` ([NEEDS CLARIFICATION] en spec.md).
     */
    async contarComponentesPadre(usuarioId: string, rango: RangoPeriodo): Promise<ComponentesScore> {
        const ventana = { gte: rango.desde, lt: rango.hasta };
        const [reportes, casos, sesiones] = await Promise.all([
            this.db.reporte.count({
                where: { usuarioId, eliminado: false, creadoEn: ventana },
            }),
            this.db.expediente.count({ where: { padreUsuarioId: usuarioId, fechaApertura: ventana } }),
            this.db.sesionLog.count({ where: { usuarioId, iniciadaEn: ventana } }),
        ]);
        return { ...COMPONENTES_EN_CERO, reportes, casos, sesiones };
    }

    /**
     * Upsert idempotente del snapshot por `(suscripcionId, periodo)`: el create
     * usa `data` tal cual; el update reescribe componentes/pesos/scoreTotal y
     * refresca `calculadoEn` (auditable: cada recálculo congela los pesos usados).
     */
    async upsertScoreCliente(data: Prisma.ScoreClienteUncheckedCreateInput): Promise<void> {
        const { suscripcionId, periodo, ...valores } = data;
        await this.db.scoreCliente.upsert({
            where: { suscripcionId_periodo: { suscripcionId, periodo } },
            create: data,
            update: { ...valores, calculadoEn: new Date() },
        });
    }

    /** Scores del período de una cohorte (ids de suscripciones), para el percentil. */
    async listarScoresDeCohorte(
        suscripcionIds: string[],
        periodo: string
    ): Promise<{ suscripcionId: string; scoreTotal: number }[]> {
        return this.db.scoreCliente.findMany({
            where: { suscripcionId: { in: suscripcionIds }, periodo },
            select: { suscripcionId: true, scoreTotal: true },
        });
    }

    /** Actualiza el percentil de cohorte de un snapshot ya calculado. */
    async actualizarPercentil(
        suscripcionId: string,
        periodo: string,
        percentil: number | null
    ): Promise<void> {
        await this.db.scoreCliente.update({
            where: { suscripcionId_periodo: { suscripcionId, periodo } },
            data: { percentilEnCohorte: percentil },
        });
    }

    /**
     * Purga de retención: DELETE de snapshots con `periodo` anterior al límite
     * (comparación lexicográfica "YYYY-MM" ≡ cronológica). Devuelve el conteo.
     */
    async eliminarSnapshotsAnterioresA(periodoLimite: string): Promise<number> {
        const eliminadas = await this.db.scoreCliente.deleteMany({
            where: { periodo: { lt: periodoLimite } },
        });
        return eliminadas.count;
    }

    // ── SPEC-223 (002-PI-124): lecturas y persistencia del digest semanal ─────
    // Todo es conteo/suma agregada de negocio: nunca textos de reportes ni PII
    // de menores (FR-007). Los nombres visibles son clientes B2B (colegio o
    // titular de la suscripción), alcance ADMIN.

    /**
     * KPIs crudos de la ventana `[desde, hasta)` (data-model §4):
     * recaudo = `Pago` AUTORIZADO con `fechaAutorizacion` en la ventana (USD
     * neto siempre; COP solo cuando `monedaLocal = 'COP'`), nuevas/canceladas
     * por `Suscripcion.createdAt`/`canceladaEn`, y activas al inicio
     * (creadas antes de `desde` y no canceladas antes de `desde`) como
     * denominador del churn.
     */
    async kpisVentana(rango: RangoPeriodo): Promise<KpisVentanaCrudos> {
        const ventana = { gte: rango.desde, lt: rango.hasta };
        const [recaudoUSD, recaudoCOP, nuevas, canceladas, activasAlInicio] = await Promise.all([
            this.db.pago.aggregate({
                _sum: { montoNetoUSD: true },
                where: { estado: "AUTORIZADO", fechaAutorizacion: ventana },
            }),
            this.db.pago.aggregate({
                _sum: { montoLocalPagado: true },
                where: { estado: "AUTORIZADO", fechaAutorizacion: ventana, monedaLocal: "COP" },
            }),
            this.db.suscripcion.count({ where: { createdAt: ventana } }),
            this.db.suscripcion.count({ where: { canceladaEn: ventana } }),
            this.db.suscripcion.count({
                where: {
                    createdAt: { lt: rango.desde },
                    OR: [{ canceladaEn: null }, { canceladaEn: { gte: rango.desde } }],
                },
            }),
        ]);
        return {
            recaudoUSD: recaudoUSD._sum.montoNetoUSD ?? 0,
            recaudoCOP: recaudoCOP._sum.montoLocalPagado ?? 0,
            nuevas,
            canceladas,
            activasAlInicio,
        };
    }

    /** Top N decisiones: `Recomendacion` PENDIENTE por prioridad (FR-005.1). */
    topRecomendacionesPendientes(take = 5): Promise<DecisionTopDigest[]> {
        return this.db.recomendacion.findMany({
            where: { estado: "PENDIENTE" },
            orderBy: [{ prioridad: "desc" }, { generadaEn: "desc" }],
            take,
            select: { titulo: true, descripcion: true, accionSugerida: true },
        });
    }

    /**
     * Snapshots de score del período mensual ("YYYY-MM") ordenados por
     * `scoreTotal` descendente, con el nombre visible del cliente B2B
     * (colegio o titular de la suscripción; email solo como último fallback).
     */
    async scoresConNombreCliente(periodoMes: string): Promise<ScoreClienteDigest[]> {
        const filas = await this.db.scoreCliente.findMany({
            where: { periodo: periodoMes },
            orderBy: { scoreTotal: "desc" },
            select: {
                scoreTotal: true,
                suscripcion: {
                    select: {
                        colegio: { select: { nombre: true } },
                        usuario: { select: { nombre: true, email: true } },
                    },
                },
            },
        });
        return filas.map((f) => ({
            nombre:
                f.suscripcion.colegio?.nombre ??
                f.suscripcion.usuario?.nombre ??
                f.suscripcion.usuario?.email ??
                "Cliente sin nombre",
            scoreTotal: f.scoreTotal,
        }));
    }

    /**
     * Anomalías de la ventana (SPEC-225). Tope de 20: un digest con cientos de
     * anomalías es ilegible; el panel las lista completas.
     */
    anomaliasEnVentana(rango: RangoPeriodo): Promise<AnomaliaDigest[]> {
        return this.db.anomalia.findMany({
            where: { detectadaEn: { gte: rango.desde, lt: rango.hasta } },
            orderBy: { detectadaEn: "desc" },
            take: 20,
            select: { severidad: true, descripcion: true },
        });
    }

    /** Digest persistido por (periodo, destinatario); null si no se generó. */
    buscarDigest(periodo: string, destinatarioId: string): Promise<DigestSemanal | null> {
        return this.db.digestSemanal.findUnique({
            where: { periodo_destinatarioId: { periodo, destinatarioId } },
        });
    }

    /**
     * Upsert idempotente del digest por `(periodo, destinatarioId)`: el create
     * lo deja en estado "generado"; el update regenera contenido y resetea el
     * estado (solo se llama cuando el digest NO está "enviado" — el guard es
     * responsabilidad del servicio).
     */
    upsertDigest(data: DatosDigestUpsert): Promise<DigestSemanal> {
        const { periodo, destinatarioId, ...contenidoCrudo } = data;
        const contenido = {
            top5Decisiones: contenidoCrudo.top5Decisiones as Prisma.InputJsonValue,
            kpisSemana: contenidoCrudo.kpisSemana as Prisma.InputJsonValue,
            kpisVsPrevia: contenidoCrudo.kpisVsPrevia as Prisma.InputJsonValue,
            enlacePanel: contenidoCrudo.enlacePanel,
        };
        return this.db.digestSemanal.upsert({
            where: { periodo_destinatarioId: { periodo, destinatarioId } },
            create: { periodo, destinatarioId, ...contenido, estado: "generado" },
            update: { ...contenido, estado: "generado", generadoEn: new Date(), enviadoEn: null },
        });
    }

    /** Marca el digest como enviado (con `enviadoEn`). */
    async marcarDigestEnviado(id: string): Promise<void> {
        await this.db.digestSemanal.update({
            where: { id },
            data: { estado: "enviado", enviadoEn: new Date() },
        });
    }

    /** Marca el digest como fallido (el motivo va al AuditLog, FR-014). */
    async marcarDigestFallido(id: string): Promise<void> {
        await this.db.digestSemanal.update({ where: { id }, data: { estado: "fallido" } });
    }

    /** Destinatarios por defecto del digest: usuarios ADMIN activos (FR-010). */
    listarAdminsActivosDigest(): Promise<DestinatarioAdminDigest[]> {
        return this.db.usuario.findMany({
            where: { rol: "ADMIN", estado: "activo" },
            select: { id: true, email: true },
        });
    }

    /** Resuelve un correo del parámetro de destinatarios a usuario, si existe. */
    buscarUsuarioDigestPorEmail(email: string): Promise<DestinatarioAdminDigest | null> {
        return this.db.usuario.findUnique({ where: { email }, select: { id: true, email: true } });
    }
}
