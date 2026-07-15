import { prisma } from "./prisma";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";

export interface ScoreResult {
    score: number;
    nivelRiesgo: NivelRiesgo;
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
        OTRO: 20,
    };
}

async function getScoringParams(): Promise<ScoringParams> {
    const get = async (clave: string, fallback: string) => {
        const p = await prisma.parametroSistema.findUnique({ where: { clave } });
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

export function determinarNivelRiesgo(score: number, thresholds: { low: number; medium: number; high: number }): NivelRiesgo {
    if (score >= thresholds.high) return "CRITICO";
    if (score >= thresholds.medium) return "ALTO";
    if (score >= thresholds.low) return "MEDIO";
    return "BAJO";
}

export async function calcularScore(identificador: string, plataformaId: string): Promise<ScoreResult> {
    const params = await getScoringParams();

    const reportes = await prisma.reporte.findMany({
        where: {
            identificador,
            plataformaId,
            estado: { in: ESTADOS_VISIBLES },
        },
        select: {
            id: true,
            esAnonimo: true,
            ciudad: true,
            pais: true,
            creadoEn: true,
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

    // Componentes del score (0-100)
    const scoreCantidad = Math.min(totalReportes * params.weightCount, params.weightCount * 10);
    const scoreRecencia = totalReportes > 0 ? (reportesRecientes / totalReportes) * params.weightRecency : 0;
    const scoreSeveridad = totalReportes > 0 ? (sumaSeveridad / totalReportes / 100) * params.weightSeverity : 0;
    const scoreAutenticacion = ratioAutenticados * params.weightAuthenticated;
    const ciudadesUnicas = Object.keys(porCiudad).length;
    const paisesUnicos = Object.keys(porPais).length;
    const scoreDiversidad = Math.min(ciudadesUnicas / params.maxCiudadesDiversidad, 1) * params.weightDiversity;

    const rawScore = scoreCantidad + scoreRecencia + scoreSeveridad + scoreAutenticacion + scoreDiversidad;
    const maxScore =
        params.weightCount * 10 +
        params.weightRecency +
        params.weightSeverity +
        params.weightAuthenticated +
        params.weightDiversity;

    const score = maxScore > 0 ? Math.min(Math.round((rawScore / maxScore) * 100), 100) : 0;

    const categorias = Object.entries(porCategoria)
        .map(([categoria, cantidad]) => ({ categoria: categoria as CategoriaConducta, cantidad: cantidad as number }))
        .sort((a, b) => b.cantidad - a.cantidad);

    const timeline = Object.entries(porMes)
        .map(([mes, cantidad]) => ({ mes, cantidad }))
        .sort((a, b) => a.mes.localeCompare(b.mes));

    return {
        score,
        nivelRiesgo: determinarNivelRiesgo(score, params.thresholds),
        totalReportes,
        reportesAutenticados,
        reportesAnonimos,
        ratioAutenticados,
        reportesRecientes,
        ciudadesUnicas,
        paisesUnicos,
        categorias,
        timeline,
        distribucion: { porCiudad, porPais },
        ultimoReporte: reportes[0]?.creadoEn ?? null,
    };
}

/**
 * Recalcula el score de un identificador y persiste el resultado en
 * `IdentificadorReportado` para lecturas rápidas en dashboard/admin.
 */
export async function recalcularYGuardarScore(identificador: string, plataformaId: string): Promise<ScoreResult> {
    const resultado = await calcularScore(identificador, plataformaId);

    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId } },
        update: {
            score: resultado.score,
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
            nivelRiesgo: resultado.nivelRiesgo,
            ultimoReporteEn: resultado.ultimoReporte ?? new Date(),
        },
    });

    return resultado;
}
