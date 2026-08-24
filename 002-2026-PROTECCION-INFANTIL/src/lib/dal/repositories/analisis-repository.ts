/**
 * SPEC-220 (002-PI-121): repositorio DAL del dominio Análisis.
 * Aísla TODO el acceso a Prisma del dominio (frontera Q-3): la UI (ficha de
 * cliente del módulo Pagos) y el servicio `src/lib/analisis/score.ts` consumen
 * esta clase; fuera de aquí nadie importa `@/lib/prisma` para este dominio.
 * Solo conteos agregados y snapshots: nunca texto de reportes ni PII.
 */
import type { Prisma, ScoreCliente } from "@prisma/client";
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
}
