import { prisma } from "@/lib/prisma";
import type { CategoriaConducta } from "@prisma/client";

export interface MetricaCategoria {
    precision: number;
    recall: number;
    f1: number;
    support: number;
    aciertos: number;
    fallos: number;
}

export interface FalsoNegativo {
    indice: number;
    identificador: string;
    esperado: string;
    asignado: string;
    confianza: number;
    estado: string;
}

export interface MetricasSimulacion {
    totalCasos: number;
    progreso: number;
    aciertos: number;
    fallos: number;
    omitidos: number;
    accuracy: number;
    porCategoria: Record<string, MetricaCategoria>;
    matrizConfusion: Array<{ esperado: string; asignado: string; count: number }>;
    falsosNegativos: FalsoNegativo[];
    latenciaPromedioMs: number;
    latenciaP50Ms: number;
    latenciaP95Ms: number;
    usoDesempate: { casos: number; porcentaje: number };
    distribucionEstados: Record<string, number>;
}

const CATEGORIAS_GRAVE = new Set([
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "EXTORSION",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
    "SUPLANTACION_IDENTIDAD",
]);

function percentil(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const k = (sorted.length - 1) * (p / 100);
    const f = Math.floor(k);
    const c = Math.ceil(k);
    if (f === c) return sorted[f];
    return sorted[f] * (c - k) + sorted[c] * (k - f);
}

export function canonizarCategoria(valor?: string | null): string {
    if (!valor) return "DESCONOCIDA";
    return valor.trim().toUpperCase().replace(/\s+/g, "_");
}

export async function calcularMetricasSimulacion(runId: string): Promise<MetricasSimulacion> {
    const relacionados = await prisma.simulacionReporte.findMany({
        where: { simulacionRunId: runId },
        select: { reporteId: true, indice: true, categoriaEsperada: true },
    });

    const reportes = await prisma.reporte.findMany({
        where: { id: { in: relacionados.map((r) => r.reporteId) } },
        select: { id: true, identificador: true, estado: true },
    });

    const clasificaciones = await prisma.clasificacionIA.findMany({
        where: { reporteId: { in: relacionados.map((r) => r.reporteId) } },
        select: { reporteId: true, categoria: true, confianza: true, latenciaMs: true, usoCascada: true },
    });

    const reporteMap = new Map(reportes.map((r) => [r.id, r]));
    const clasifMap = new Map(clasificaciones.map((c) => [c.reporteId, c]));

    let aciertos = 0;
    let fallos = 0;
    let omitidos = 0;
    let casosDesempate = 0;
    const latencias: number[] = [];
    const distribucionEstados: Record<string, number> = {};
    const confusion: Map<string, number> = new Map();
    const categoryStats: Map<string, { tp: number; fp: number; fn: number; support: number }> = new Map();
    const falsosNegativos: FalsoNegativo[] = [];

    for (const rel of relacionados) {
        const reporte = reporteMap.get(rel.reporteId);
        const clasif = clasifMap.get(rel.reporteId);
        const estado = reporte?.estado ?? "DESCONOCIDO";
        distribucionEstados[estado] = (distribucionEstados[estado] ?? 0) + 1;

        if (clasif?.latenciaMs) {
            latencias.push(clasif.latenciaMs);
        }
        if (clasif?.usoCascada) {
            casosDesempate++;
        }

        const esperadoRaw = rel.categoriaEsperada;
        if (!esperadoRaw) {
            omitidos++;
            continue;
        }

        const esperado = canonizarCategoria(esperadoRaw);
        const asignado = clasif ? String(clasif.categoria) : "DESCONOCIDA";

        const confKey = `${esperado}::${asignado}`;
        confusion.set(confKey, (confusion.get(confKey) ?? 0) + 1);

        if (!categoryStats.has(esperado)) {
            categoryStats.set(esperado, { tp: 0, fp: 0, fn: 0, support: 0 });
        }
        const esperadoStats = categoryStats.get(esperado)!;
        esperadoStats.support += 1;
        if (esperado === asignado) {
            esperadoStats.tp += 1;
            aciertos += 1;
        } else {
            esperadoStats.fn += 1;
            fallos += 1;
        }

        if (!categoryStats.has(asignado)) {
            categoryStats.set(asignado, { tp: 0, fp: 0, fn: 0, support: 0 });
        }
        const asignadoStats = categoryStats.get(asignado)!;
        if (esperado !== asignado) {
            asignadoStats.fp += 1;
        }

        if (CATEGORIAS_GRAVE.has(esperado) && esperado !== asignado) {
            falsosNegativos.push({
                indice: rel.indice,
                identificador: reporte?.identificador ?? "",
                esperado,
                asignado,
                confianza: clasif?.confianza ?? 0,
                estado,
            });
        }
    }

    const porCategoria: Record<string, MetricaCategoria> = {};
    for (const [cat, stats] of categoryStats.entries()) {
        const precision = stats.tp + stats.fp > 0 ? stats.tp / (stats.tp + stats.fp) : 0;
        const recall = stats.tp + stats.fn > 0 ? stats.tp / (stats.tp + stats.fn) : 0;
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
        porCategoria[cat] = {
            precision,
            recall,
            f1,
            support: stats.support,
            aciertos: stats.tp,
            fallos: stats.fn,
        };
    }

    const matrizConfusion = Array.from(confusion.entries()).map(([key, count]) => {
        const [esperado, asignado] = key.split("::");
        return { esperado, asignado, count };
    });

    const totalConEsperado = aciertos + fallos;
    const accuracy = totalConEsperado > 0 ? aciertos / totalConEsperado : 0;
    const latenciaPromedioMs = latencias.length > 0 ? latencias.reduce((a, b) => a + b, 0) / latencias.length : 0;

    return {
        totalCasos: relacionados.length,
        progreso: relacionados.length,
        aciertos,
        fallos,
        omitidos,
        accuracy,
        porCategoria,
        matrizConfusion,
        falsosNegativos,
        latenciaPromedioMs,
        latenciaP50Ms: percentil(latencias, 50),
        latenciaP95Ms: percentil(latencias, 95),
        usoDesempate: {
            casos: casosDesempate,
            porcentaje: relacionados.length > 0 ? casosDesempate / relacionados.length : 0,
        },
        distribucionEstados,
    };
}
