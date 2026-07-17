import { prisma } from "./prisma";
import type { Prisma, CategoriaConducta, EstadoReporte } from "@prisma/client";

export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";

export interface ScoreResult {
    score: number;
    nivelRiesgo: NivelRiesgo;
    scoreAnonimo: number;
    scoreAutenticado: number;
    scoreAjustado: number;
    pesoAnonimoPromedio: number;
    pesoAutenticadoPromedio: number;
    totalReportes: number;
    reportesAutenticados: number;
    reportesAnonimos: number;
    ratioAutenticados: number;
    reportesRecientes: number;
    ciudadesUnicas: number;
    paisesUnicos: number;
    categorias: { categoria: CategoriaConducta; cantidad: number }[];
    timeline: { mes: string; cantidad: number }[];
    distribucion: {
        porCiudad: Record<string, number>;
        porPais: Record<string, number>;
    };
    ultimoReporte: Date | null;
}

interface ScoringParams {
    weightCount: number;
    weightRecency: number;
    weightSeverity: number;
    weightAuthenticated: number;
    weightDiversity: number;
    recencyDays: number;
    maxCiudadesDiversidad: number;
    thresholds: { low: number; medium: number; high: number };
    severity: Record<CategoriaConducta, number>;
}

const ESTADOS_VISIBLES = ["CLASIFICADO", "CORREGIDO"] as EstadoReporte[];

const CATEGORIAS_DEFAULT: CategoriaConducta[] = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "EXTORSION",
    "CONTENIDO_GENERADO_IA",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
    "OTRO",
];

function getDefaultSeverity(): Record<CategoriaConducta, number> {
    return {
        CONTACTO_INSISTENTE: 30,
        SOLICITUD_MATERIAL: 80,
        OFRECIMIENTO_REGALOS: 60,
        SUPLANTACION_IDENTIDAD: 70,
        SOLICITUD_ENCUENTRO: 90,
        COMPARTIMIENTO_SEXUAL: 95,
        EXTORSION: 85,
        CONTENIDO_GENERADO_IA: 75,
        DIFUSION_NO_CONSENTIDA: 90,
        DOXING: 85,
        OTRO: 20,
    };
}

async function getScoringParams(tx?: Prisma.TransactionClient): Promise<ScoringParams> {
    const db = tx ?? prisma;
    const get = async (clave: string, fallback: string) => {
        const p = await db.parametroSistema.findUnique({ where: { clave } });
        return p?.valor ?? fallback;
    };

    const severity: Record<CategoriaConducta, number> = { ...getDefaultSeverity() };
    for (const cat of CATEGORIAS_DEFAULT) {
        const val = await get(`scoring.severity.${cat}`, String(severity[cat]));
        severity[cat] = parseFloat(val) || severity[cat];
    }

    return {
        weightCount: parseFloat(await get("scoring.weight.count", "10")),
        weightRecency: parseFloat(await get("scoring.weight.recency", "15")),
        weightSeverity: parseFloat(await get("scoring.weight.severity", "45")),
        weightAuthenticated: parseFloat(await get("scoring.weight.authenticated", "20")),
        weightDiversity: parseFloat(await get("scoring.weight.diversity", "10")),
        recencyDays: parseInt(await get("scoring.recency_days", "90"), 10),
        maxCiudadesDiversidad: parseInt(await get("scoring.diversity.max_cities", "5"), 10),
        thresholds: {
            low: parseFloat(await get("scoring.threshold.low", "35")),
            medium: parseFloat(await get("scoring.threshold.medium", "60")),
            high: parseFloat(await get("scoring.threshold.high", "80")),
        },
        severity,
    };
}

export async function isSourceWeightEnabled(tx?: Prisma.TransactionClient): Promise<boolean> {
    const db = tx ?? prisma;
    const p = await db.parametroSistema.findUnique({ where: { clave: "scoring.source_weight.enabled" } });
    return p?.valor === "true";
}

export function determinarNivelRiesgo(score: number, thresholds: { low: number; medium: number; high: number }): NivelRiesgo {
    if (score >= thresholds.high) return "CRITICO";
    if (score >= thresholds.medium) return "ALTO";
    if (score >= thresholds.low) return "MEDIO";
    return "BAJO";
}

interface ReporteScoreInput {
    id: string;
    esAnonimo: boolean;
    ciudad: string;
    pais: string;
    creadoEn: Date;
    fuenteConfianza: number | null;
    clasificacion: { categoria: CategoriaConducta } | null;
}

interface ComponentesScore {
    scoreCantidad: number;
    scoreRecencia: number;
    scoreSeveridad: number;
    scoreAutenticacion: number;
    scoreDiversidad: number;
    ciudadesUnicas: number;
    paisesUnicos: number;
    reportesRecientes: number;
    categorias: { categoria: CategoriaConducta; cantidad: number }[];
    timeline: { mes: string; cantidad: number }[];
    distribucion: { porCiudad: Record<string, number>; porPais: Record<string, number> };
}

function calcularComponentesScore(reportes: ReporteScoreInput[], params: ScoringParams): ComponentesScore {
    const totalReportes = reportes.length;
    const reportesAutenticados = reportes.filter((r) => !r.esAnonimo).length;
    const ratioAutenticados = totalReportes > 0 ? reportesAutenticados / totalReportes : 0;

    const porCiudad: Record<string, number> = {};
    const porPais: Record<string, number> = {};
    const porMes: Record<string, number> = {};
    const porCategoria: Partial<Record<CategoriaConducta, number>> = {};

    const ahora = Date.now();
    const recenciaLimite = ahora - params.recencyDays * 24 * 60 * 60 * 1000;
    let reportesRecientes = 0;
    let sumaSeveridad = 0;

    for (const r of reportes) {
        porCiudad[r.ciudad] = (porCiudad[r.ciudad] || 0) + 1;
        porPais[r.pais] = (porPais[r.pais] || 0) + 1;
        const mes = r.creadoEn.toISOString().slice(0, 7);
        porMes[mes] = (porMes[mes] || 0) + 1;

        if (r.creadoEn.getTime() >= recenciaLimite) {
            reportesRecientes++;
        }

        const cat = r.clasificacion?.categoria;
        if (cat) {
            porCategoria[cat] = (porCategoria[cat] || 0) + 1;
            sumaSeveridad += params.severity[cat] ?? 50;
        }
    }

    const scoreCantidad = Math.min(totalReportes * params.weightCount, params.weightCount * 10);
    const scoreRecencia = totalReportes > 0 ? (reportesRecientes / totalReportes) * params.weightRecency : 0;
    const scoreSeveridad = totalReportes > 0 ? (sumaSeveridad / totalReportes / 100) * params.weightSeverity : 0;
    const scoreAutenticacion = ratioAutenticados * params.weightAuthenticated;
    const ciudadesUnicas = Object.keys(porCiudad).length;
    const paisesUnicos = Object.keys(porPais).length;
    const scoreDiversidad = Math.min(ciudadesUnicas / params.maxCiudadesDiversidad, 1) * params.weightDiversity;

    const categorias = Object.entries(porCategoria)
        .map(([categoria, cantidad]) => ({ categoria: categoria as CategoriaConducta, cantidad: cantidad as number }))
        .sort((a, b) => b.cantidad - a.cantidad);

    const timeline = Object.entries(porMes)
        .map(([mes, cantidad]) => ({ mes, cantidad }))
        .sort((a, b) => a.mes.localeCompare(b.mes));

    return {
        scoreCantidad,
        scoreRecencia,
        scoreSeveridad,
        scoreAutenticacion,
        scoreDiversidad,
        ciudadesUnicas,
        paisesUnicos,
        reportesRecientes,
        categorias,
        timeline,
        distribucion: { porCiudad, porPais },
    };
}

function scoreFromComponentes(componentes: ComponentesScore, params: ScoringParams): number {
    const rawScore =
        componentes.scoreCantidad +
        componentes.scoreRecencia +
        componentes.scoreSeveridad +
        componentes.scoreAutenticacion +
        componentes.scoreDiversidad;
    const maxScore =
        params.weightCount * 10 +
        params.weightRecency +
        params.weightSeverity +
        params.weightAuthenticated +
        params.weightDiversity;
    return maxScore > 0 ? Math.min(Math.round((rawScore / maxScore) * 100), 100) : 0;
}

export async function calcularScore(
    identificador: string,
    plataformaId?: string,
    tx?: Prisma.TransactionClient,
    opts?: { forceSourceWeight?: boolean }
): Promise<ScoreResult> {
    const db = tx ?? prisma;
    const params = await getScoringParams(tx);
    const sourceWeightEnabled = opts?.forceSourceWeight || (await isSourceWeightEnabled(tx));

    const where: { identificador: string; plataformaId?: string; estado: { in: EstadoReporte[] }; eliminado: boolean } = {
        identificador,
        estado: { in: ESTADOS_VISIBLES },
        eliminado: false,
    };
    if (plataformaId) {
        where.plataformaId = plataformaId;
    }

    const reportes = await db.reporte.findMany({
        where,
        select: {
            id: true,
            esAnonimo: true,
            ciudad: true,
            pais: true,
            creadoEn: true,
            fuenteConfianza: true,
            clasificacion: {
                select: { categoria: true },
            },
        },
        orderBy: { creadoEn: "desc" },
        take: 1000,
    });

    const totalReportes = reportes.length;
    const reportesAutenticados = reportes.filter((r) => !r.esAnonimo).length;
    const reportesAnonimos = totalReportes - reportesAutenticados;
    const ratioAutenticados = totalReportes > 0 ? reportesAutenticados / totalReportes : 0;

    const componentesTotal = calcularComponentesScore(reportes, params);
    const score = scoreFromComponentes(componentesTotal, params);

    const anonimos = reportes.filter((r) => r.esAnonimo);
    const autenticados = reportes.filter((r) => !r.esAnonimo);

    const componentesAnonimo = calcularComponentesScore(anonimos, params);
    const componentesAutenticado = calcularComponentesScore(autenticados, params);

    const scoreAnonimo = scoreFromComponentes(componentesAnonimo, params);
    const scoreAutenticado = scoreFromComponentes(componentesAutenticado, params);

    const pesoAnonimoPromedio =
        sourceWeightEnabled && anonimos.length > 0
            ? anonimos.reduce((acc, r) => acc + (r.fuenteConfianza ?? 1.0), 0) / anonimos.length
            : 1.0;
    const pesoAutenticadoPromedio =
        sourceWeightEnabled && autenticados.length > 0
            ? autenticados.reduce((acc, r) => acc + (r.fuenteConfianza ?? 1.0), 0) / autenticados.length
            : 1.0;

    const rawAjustado = scoreAnonimo * pesoAnonimoPromedio + scoreAutenticado * pesoAutenticadoPromedio;
    const scoreAjustado = Math.min(Math.round(rawAjustado), 100);

    return {
        score,
        nivelRiesgo: determinarNivelRiesgo(score, params.thresholds),
        scoreAnonimo,
        scoreAutenticado,
        scoreAjustado,
        pesoAnonimoPromedio,
        pesoAutenticadoPromedio,
        totalReportes,
        reportesAutenticados,
        reportesAnonimos,
        ratioAutenticados,
        reportesRecientes: componentesTotal.reportesRecientes,
        ciudadesUnicas: componentesTotal.ciudadesUnicas,
        paisesUnicos: componentesTotal.paisesUnicos,
        categorias: componentesTotal.categorias,
        timeline: componentesTotal.timeline,
        distribucion: componentesTotal.distribucion,
        ultimoReporte: reportes[0]?.creadoEn ?? null,
    };
}

/**
 * Recalcula el score de un identificador y persiste el resultado en
 * `IdentificadorReportado` para lecturas rápidas en dashboard/admin.
 */
export async function recalcularYGuardarScore(
    identificador: string,
    plataformaId: string,
    tx?: Prisma.TransactionClient
): Promise<ScoreResult> {
    const db = tx ?? prisma;
    const resultado = await calcularScore(identificador, plataformaId, tx);

    await db.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId } },
        update: {
            totalReportes: resultado.totalReportes,
            reportesAutenticados: resultado.reportesAutenticados,
            reportesAnonimos: resultado.reportesAnonimos,
            score: resultado.score,
            scoreAnonimo: resultado.scoreAnonimo,
            scoreAutenticado: resultado.scoreAutenticado,
            scoreAjustado: resultado.scoreAjustado,
            nivelRiesgo: resultado.nivelRiesgo,
            ultimoReporteEn: resultado.ultimoReporte ?? new Date(),
        },
        create: {
            identificador,
            plataformaId,
            totalReportes: resultado.totalReportes,
            reportesAutenticados: resultado.reportesAutenticados,
            reportesAnonimos: resultado.reportesAnonimos,
            score: resultado.score,
            scoreAnonimo: resultado.scoreAnonimo,
            scoreAutenticado: resultado.scoreAutenticado,
            scoreAjustado: resultado.scoreAjustado,
            nivelRiesgo: resultado.nivelRiesgo,
            ultimoReporteEn: resultado.ultimoReporte ?? new Date(),
        },
    });

    return resultado;
}
