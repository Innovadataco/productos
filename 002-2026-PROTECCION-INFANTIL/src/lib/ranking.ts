import { prisma } from "./prisma";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO";

export interface RankingResult {
    score: number;
    nivelRiesgo: NivelRiesgo;
    totalReportes: number;
    reportesAutenticados: number;
    reportesAnonimos: number;
    ratioAutenticados: number;
    categorias: { categoria: CategoriaConducta; cantidad: number }[];
    timeline: { mes: string; cantidad: number }[];
    distribucion: {
        porCiudad: Record<string, number>;
        porPais: Record<string, number>;
    };
    ultimoReporte: Date | null;
}

interface RankingParams {
    weightCount: number;
    weightRecency: number;
    weightSeverity: number;
    weightAuthenticated: number;
    recencyDays: number;
    thresholds: { low: number; medium: number };
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

async function getRankingParams(): Promise<RankingParams> {
    const get = async (clave: string, fallback: string) => {
        const p = await prisma.parametroSistema.findUnique({ where: { clave } });
        return p?.valor ?? fallback;
    };

    const severity: Record<CategoriaConducta, number> = { ...getDefaultSeverity() };
    for (const cat of CATEGORIAS_DEFAULT) {
        const val = await get(`ranking.severity.${cat}`, String(severity[cat]));
        severity[cat] = parseFloat(val) || severity[cat];
    }

    return {
        weightCount: parseFloat(await get("ranking.weight.count", "10")),
        weightRecency: parseFloat(await get("ranking.weight.recency", "15")),
        weightSeverity: parseFloat(await get("ranking.weight.severity", "50")),
        weightAuthenticated: parseFloat(await get("ranking.weight.authenticated", "25")),
        recencyDays: parseInt(await get("ranking.recency_days", "90"), 10),
        thresholds: {
            low: parseFloat(await get("ranking.threshold.low", "30")),
            medium: parseFloat(await get("ranking.threshold.medium", "70")),
        },
        severity,
    };
}

export function calcularNivelRiesgo(score: number, thresholds: { low: number; medium: number }): NivelRiesgo {
    if (score >= thresholds.medium) return "ALTO";
    if (score >= thresholds.low) return "MEDIO";
    return "BAJO";
}

export async function calcularRanking(identificador: string, plataformaId: string): Promise<RankingResult> {
    const params = await getRankingParams();

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

    // Score 0-100
    const pesoTotal = params.weightCount + params.weightRecency + params.weightSeverity + params.weightAuthenticated;

    const scoreCantidad = Math.min(totalReportes * params.weightCount, params.weightCount * 10);
    const scoreRecencia = totalReportes > 0
        ? (reportesRecientes / totalReportes) * params.weightRecency
        : 0;
    const scoreSeveridad = totalReportes > 0
        ? (sumaSeveridad / totalReportes / 100) * params.weightSeverity
        : 0;
    const scoreAutenticacion = ratioAutenticados * params.weightAuthenticated;

    const rawScore = scoreCantidad + scoreRecencia + scoreSeveridad + scoreAutenticacion;
    const maxScore = Math.max(pesoTotal * 1.5, 100); // evita score > 100 cuando hay muchos reportes
    const score = Math.min(Math.round((rawScore / maxScore) * 100), 100);

    const categorias = Object.entries(porCategoria)
        .map(([categoria, cantidad]) => ({ categoria: categoria as CategoriaConducta, cantidad: cantidad as number }))
        .sort((a, b) => b.cantidad - a.cantidad);

    const timeline = Object.entries(porMes)
        .map(([mes, cantidad]) => ({ mes, cantidad }))
        .sort((a, b) => a.mes.localeCompare(b.mes));

    return {
        score,
        nivelRiesgo: calcularNivelRiesgo(score, params.thresholds),
        totalReportes,
        reportesAutenticados,
        reportesAnonimos,
        ratioAutenticados,
        categorias,
        timeline,
        distribucion: { porCiudad, porPais },
        ultimoReporte: reportes[0]?.creadoEn ?? null,
    };
}
