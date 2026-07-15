import { calcularScore, determinarNivelRiesgo } from "./scoring";
import type { CategoriaConducta } from "@prisma/client";

export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";

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

/**
 * @deprecated Usar `determinarNivelRiesgo` desde `src/lib/scoring.ts`.
 * Se mantiene para compatibilidad con componentes existentes.
 */
export function calcularNivelRiesgo(
    score: number,
    thresholds: { low: number; medium: number; high?: number }
): NivelRiesgo {
    return determinarNivelRiesgo(score, {
        low: thresholds.low,
        medium: thresholds.medium,
        high: thresholds.high ?? 90,
    });
}

/**
 * Calcula el ranking completo de un identificador.
 * Delega el score/nivel en `src/lib/scoring.ts`.
 */
export async function calcularRanking(identificador: string, plataformaId: string): Promise<RankingResult> {
    const scoreResult = await calcularScore(identificador, plataformaId);

    return {
        score: scoreResult.score,
        nivelRiesgo: scoreResult.nivelRiesgo,
        totalReportes: scoreResult.totalReportes,
        reportesAutenticados: scoreResult.reportesAutenticados,
        reportesAnonimos: scoreResult.reportesAnonimos,
        ratioAutenticados: scoreResult.ratioAutenticados,
        categorias: scoreResult.categorias,
        timeline: scoreResult.timeline,
        distribucion: scoreResult.distribucion,
        ultimoReporte: scoreResult.ultimoReporte,
    };
}
