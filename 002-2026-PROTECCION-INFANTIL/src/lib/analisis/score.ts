/**
 * SPEC-220 (002-PI-121): servicio del score de valor de cliente.
 *
 * - `recalcularScoresPeriodo(periodo?)`: snapshot mensual (upsert idempotente
 *   por `(suscripcionId, periodo)`) para suscripciones ACTIVA/EN_GRACIA, con
 *   los 4 pesos congelados en la fila y el percentil por cohorte
 *   `(tipoTitular, periodo)` calculado en una segunda pasada.
 * - `purgarSnapshotsAntiguos()`: retención (Ley 1581): DELETE de snapshots con
 *   `periodo` más antiguo que `analisis.score.retencion_meses`, con AuditLog
 *   por corrida de purga (solo si hubo filas eliminadas → idempotente).
 *
 * Lógica pura + orquestación: TODO el acceso a Prisma vive en el DAL
 * (`AnalisisRepository`, frontera Q-3). El cálculo usa ÚNICAMENTE conteos
 * agregados (`count`): nunca lee, copia ni persiste texto de reportes,
 * identificadores reportados ni PII (FR-008).
 */
import { getParametroSistemaValor } from "@/lib/parametros";
import { logAudit } from "@/lib/audit";
import {
    AnalisisRepository,
    type ComponentesScore,
    type RangoPeriodo,
    type SuscripcionConColegio,
} from "@/lib/dal/repositories/analisis-repository";
import {
    esPeriodoValido,
    periodoActualBogota,
    periodoLimiteRetencion,
    rangoMesBogota,
} from "./periodos";

export type { ComponentesScore } from "@/lib/dal/repositories/analisis-repository";

/** Pesos por defecto (mismos valores que el seed `analisis.score.peso_*`). */
export const PESOS_DEFAULT = { reportes: 3, casos: 5, alertas: 2, sesiones: 1 } as const;

export const RETENCION_MESES_DEFAULT = 24;

export interface PesosScore {
    reportes: number;
    casos: number;
    alertas: number;
    sesiones: number;
}

export interface ResultadoRecalculo {
    periodo: string;
    suscripcionesProcesadas: number;
    duracionMs: number;
}

export interface ResultadoPurga {
    filasEliminadas: number;
    periodoLimite: string;
}

/** Fórmula del score (brief §6): suma ponderada de los 4 componentes. */
export function calcularScoreTotal(componentes: ComponentesScore, pesos: PesosScore): number {
    return (
        componentes.reportes * pesos.reportes +
        componentes.casos * pesos.casos +
        componentes.alertas * pesos.alertas +
        componentes.sesiones * pesos.sesiones
    );
}

/**
 * Percentil 0-100 por posición de `scoreTotal` dentro de la cohorte, con rank
 * promedio en empates (mismo percentil para scores iguales). Cohorte de un
 * solo miembro → null (no hay con quién comparar).
 */
export function asignarPercentilesCohorte(
    items: { id: string; scoreTotal: number }[]
): Map<string, number | null> {
    const resultado = new Map<string, number | null>();
    if (items.length <= 1) {
        for (const item of items) resultado.set(item.id, null);
        return resultado;
    }
    const ordenados = [...items].sort((a, b) => a.scoreTotal - b.scoreTotal);
    const n = ordenados.length;
    let i = 0;
    while (i < n) {
        let j = i;
        while (j + 1 < n && ordenados[j + 1]!.scoreTotal === ordenados[i]!.scoreTotal) j += 1;
        // Rank promedio 1-based del grupo de empates [i..j] → percentil 0-100.
        const rankPromedio = (i + 1 + (j + 1)) / 2;
        const percentil = Math.round(((rankPromedio - 1) / (n - 1)) * 10000) / 100;
        for (let k = i; k <= j; k += 1) resultado.set(ordenados[k]!.id, percentil);
        i = j + 1;
    }
    return resultado;
}

function parsearPeso(valor: string | null, fallback: number): number {
    const numero = parseFloat(valor ?? "");
    return Number.isFinite(numero) ? numero : fallback;
}

/** Lee los 4 pesos desde ParametroSistema; fallback a los defaults del seed. */
export async function obtenerPesosScore(): Promise<PesosScore> {
    const [reportes, casos, alertas, sesiones] = await Promise.all([
        getParametroSistemaValor("analisis.score.peso_reportes"),
        getParametroSistemaValor("analisis.score.peso_casos"),
        getParametroSistemaValor("analisis.score.peso_alertas"),
        getParametroSistemaValor("analisis.score.peso_sesiones"),
    ]);
    return {
        reportes: parsearPeso(reportes, PESOS_DEFAULT.reportes),
        casos: parsearPeso(casos, PESOS_DEFAULT.casos),
        alertas: parsearPeso(alertas, PESOS_DEFAULT.alertas),
        sesiones: parsearPeso(sesiones, PESOS_DEFAULT.sesiones),
    };
}

/**
 * Conteos del período para una suscripción, según su tipo de titular
 * (plan §2.2). Titular PADRE no tiene fuente de alertas en v1 → 0
 * ([NEEDS CLARIFICATION] en spec.md).
 */
export async function contarComponentes(
    suscripcion: SuscripcionConColegio,
    rango: RangoPeriodo,
    repo: AnalisisRepository = new AnalisisRepository()
): Promise<ComponentesScore> {
    if (suscripcion.tipoTitular === "COLEGIO") {
        const colegio = suscripcion.colegio;
        if (!colegio?.tenantId) return { reportes: 0, casos: 0, alertas: 0, sesiones: 0 };
        return repo.contarComponentesColegio(colegio.id, colegio.tenantId, rango);
    }
    if (suscripcion.tipoTitular === "PADRE" && suscripcion.usuarioId) {
        return repo.contarComponentesPadre(suscripcion.usuarioId, rango);
    }
    return { reportes: 0, casos: 0, alertas: 0, sesiones: 0 };
}

/**
 * Recalcula el snapshot del período (default: mes actual Bogotá) para todas
 * las suscripciones con actividad comercial vigente (ACTIVA/EN_GRACIA) y
 * actualiza el percentil por cohorte `(tipoTitular, periodo)`. Idempotente:
 * re-ejecutar actualiza las mismas filas (upsert por `(suscripcionId, periodo)`).
 */
export async function recalcularScoresPeriodo(periodoParam?: string): Promise<ResultadoRecalculo> {
    const inicio = Date.now();
    const periodo = periodoParam ?? periodoActualBogota();
    if (!esPeriodoValido(periodo)) {
        throw new Error(`Período inválido (esperado "YYYY-MM"): ${periodo}`);
    }
    const rango = rangoMesBogota(periodo);
    const pesos = await obtenerPesosScore();
    const repo = new AnalisisRepository();

    const suscripciones = await repo.listarSuscripcionesVigentes();

    const procesadas: { id: string; tipoTitular: string }[] = [];
    for (const suscripcion of suscripciones) {
        const componentes = await contarComponentes(suscripcion, rango, repo);
        const scoreTotal = calcularScoreTotal(componentes, pesos);
        await repo.upsertScoreCliente({
            suscripcionId: suscripcion.id,
            periodo,
            componenteReportes: componentes.reportes,
            componenteCasos: componentes.casos,
            componenteAlertas: componentes.alertas,
            componenteSesiones: componentes.sesiones,
            pesoReportes: pesos.reportes,
            pesoCasos: pesos.casos,
            pesoAlertas: pesos.alertas,
            pesoSesiones: pesos.sesiones,
            scoreTotal,
        });
        procesadas.push({ id: suscripcion.id, tipoTitular: suscripcion.tipoTitular });
    }

    // Segunda pasada: percentil por cohorte (mismo tipoTitular, mismo período).
    const cohortes = new Map<string, string[]>();
    for (const p of procesadas) {
        const lista = cohortes.get(p.tipoTitular) ?? [];
        lista.push(p.id);
        cohortes.set(p.tipoTitular, lista);
    }
    for (const ids of cohortes.values()) {
        const scores = await repo.listarScoresDeCohorte(ids, periodo);
        const percentiles = asignarPercentilesCohorte(
            scores.map((s) => ({ id: s.suscripcionId, scoreTotal: s.scoreTotal }))
        );
        for (const [suscripcionId, percentil] of percentiles) {
            await repo.actualizarPercentil(suscripcionId, periodo, percentil);
        }
    }

    const duracionMs = Date.now() - inicio;
    console.error(
        `[ANALISIS-SCORE] Recalculo: ${procesadas.length} suscripciones — periodo=${periodo} duracionMs=${duracionMs}`
    );
    return { periodo, suscripcionesProcesadas: procesadas.length, duracionMs };
}

/**
 * Purga de retención (US4): elimina snapshots con `periodo` más antiguo que
 * `analisis.score.retencion_meses` respecto al mes actual Bogotá y registra
 * AuditLog si hubo eliminaciones (sin PII: solo metadatos de conteo). La
 * comparación es por string "YYYY-MM" (orden lexicográfico ≡ cronológico).
 * Idempotente: si no hay nada que borrar no genera AuditLog duplicado.
 */
export async function purgarSnapshotsAntiguos(): Promise<ResultadoPurga> {
    const valor = await getParametroSistemaValor("analisis.score.retencion_meses");
    let retencionMeses = parseInt(valor ?? "", 10);
    if (!Number.isFinite(retencionMeses) || retencionMeses < 1) {
        console.warn(
            `[ANALISIS-SCORE] Purga: retencion_meses inválido ("${valor ?? "ausente"}"); se usa ${RETENCION_MESES_DEFAULT}`
        );
        retencionMeses = RETENCION_MESES_DEFAULT;
    }
    const periodoLimite = periodoLimiteRetencion(retencionMeses);
    const repo = new AnalisisRepository();
    const filasEliminadas = await repo.eliminarSnapshotsAnterioresA(periodoLimite);
    if (filasEliminadas > 0) {
        await logAudit({
            accion: "ANALISIS_SCORE_PURGA",
            tipoRecurso: "ScoreCliente",
            metadatos: {
                filasEliminadas,
                periodoLimite,
                retencionMeses,
            },
            ipAddress: "worker",
            userAgent: "worker-analisis-score",
        });
    }
    console.error(
        `[ANALISIS-SCORE] Purga: ${filasEliminadas} filas eliminadas — periodoLimite=${periodoLimite}`
    );
    return { filasEliminadas, periodoLimite };
}
