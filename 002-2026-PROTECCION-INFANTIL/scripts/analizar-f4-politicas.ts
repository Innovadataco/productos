#!/usr/bin/env tsx
/**
 * Análisis offline de políticas de agregación para F4.
 * Lee el reporte JSON de eval-classifier-f4.ts y recalcula métricas
 * sin llamar al modelo.
 *
 * Uso:
 *   node --import tsx scripts/analizar-f4-politicas.ts [ruta-al-reporte-f4.json]
 */
import fs from "fs/promises";
import path from "path";

interface Voto {
    categoria: string;
    confianza: number;
    posibleAgresorPar: boolean;
}

interface Detail {
    text: string;
    expected: string;
    predicted: string;
    confidence: number;
    estado: string;
    latencyMs: number;
    correct: boolean;
    ruido: boolean;
    fallback: boolean;
    posibleAgresorPar: boolean;
    posibleAgresorParMayoritario: boolean;
    secundarias: string[];
    secundariaCorrecta: boolean;
    votos: Voto[];
    guardaDoxing: boolean;
    guardaDoxingVerdadera: boolean;
}

interface Report {
    metadata: { model: string; nVotos: number; temperaturaVotos: number; fixture: string };
    perRun: unknown[];
    summary: unknown;
    details: Detail[];
}

type Policy = { name: string; decide: (counts: Map<string, number>, n: number) => { estado: string; confidence: number } };

function computeMetrics(details: Detail[]) {
    const total = details.length;
    const correct = details.filter((d) => d.correct).length;
    const accuracy = total === 0 ? 0 : correct / total;
    const clasificados = details.filter((d) => d.estado === "CLASIFICADO");
    const correctosClasificados = clasificados.filter((d) => d.correct).length;
    const precisionAutoClasificados = clasificados.length === 0 ? 0 : correctosClasificados / clasificados.length;
    const errorSilencioso = 1 - precisionAutoClasificados;
    const revisionManualRate = details.filter((d) => d.estado === "REVISION_MANUAL").length / total;
    return { accuracy, precisionAutoClasificados, errorSilencioso, revisionManualRate, clasificados: clasificados.length };
}

function applyPolicy(detail: Detail, policy: Policy): Detail {
    const n = detail.votos.length;
    const counts = new Map<string, number>();
    for (const v of detail.votos) {
        counts.set(v.categoria, (counts.get(v.categoria) ?? 0) + 1);
    }
    const { estado, confidence } = policy.decide(counts, n);
    const ranking = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const predicted = ranking[0]?.[0] ?? "OTRO";
    const correct = predicted === detail.expected;

    // posibleAgresorPar por voto mayoritario
    const trueVotes = detail.votos.filter((v) => v.posibleAgresorPar).length;
    const posibleAgresorParMayoritario = trueVotes / n >= 0.5;

    return {
        ...detail,
        predicted,
        confidence,
        estado,
        correct,
        posibleAgresorPar: posibleAgresorParMayoritario,
    };
}

const policies: Policy[] = [
    {
        name: "umbral_0.5",
        decide: (counts, n) => {
            const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
            const conf = (top?.[1] ?? 0) / n;
            return { estado: conf >= 0.5 ? "CLASIFICADO" : "REVISION_MANUAL", confidence: conf };
        },
    },
    {
        name: "umbral_0.6",
        decide: (counts, n) => {
            const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
            const conf = (top?.[1] ?? 0) / n;
            return { estado: conf >= 0.6 ? "CLASIFICADO" : "REVISION_MANUAL", confidence: conf };
        },
    },
    {
        name: "umbral_0.8",
        decide: (counts, n) => {
            const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
            const conf = (top?.[1] ?? 0) / n;
            return { estado: conf >= 0.8 ? "CLASIFICADO" : "REVISION_MANUAL", confidence: conf };
        },
    },
    {
        name: "margen_2",
        decide: (counts, n) => {
            const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
            const top = sorted[0]?.[1] ?? 0;
            const second = sorted[1]?.[1] ?? 0;
            const conf = top / n;
            return { estado: top - second >= 2 ? "CLASIFICADO" : "REVISION_MANUAL", confidence: conf };
        },
    },
    {
        name: "umbral_0.6 + margen_2",
        decide: (counts, n) => {
            const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
            const top = sorted[0]?.[1] ?? 0;
            const second = sorted[1]?.[1] ?? 0;
            const conf = top / n;
            return { estado: conf >= 0.6 && top - second >= 2 ? "CLASIFICADO" : "REVISION_MANUAL", confidence: conf };
        },
    },
    {
        // T1: solo clasifica si hay unanimidad 5/5; de lo contrario manda a revisión.
        name: "umbral_1.0",
        decide: (counts, n) => {
            const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
            const conf = (top?.[1] ?? 0) / n;
            return { estado: conf >= 1.0 ? "CLASIFICADO" : "REVISION_MANUAL", confidence: conf };
        },
    },
];

async function main() {
    const reportPath = process.argv[2];
    if (!reportPath) {
        console.error("Uso: node --import tsx scripts/analizar-f4-politicas.ts <reporte-f4.json>");
        process.exit(1);
    }
    const raw = await fs.readFile(reportPath, "utf-8");
    const report: Report = JSON.parse(raw);

    console.log(`Análisis offline de políticas F4 sobre ${report.details.length} ejemplos\n`);
    console.log(`Modelo: ${report.metadata.model}, nVotos: ${report.metadata.nVotos}, temperatura: ${report.metadata.temperaturaVotos}\n`);

    const rows = policies.map((policy) => {
        const recalculated = report.details.map((d) => applyPolicy(d, policy));
        const metrics = computeMetrics(recalculated);
        return {
            politica: policy.name,
            accuracy: (metrics.accuracy * 100).toFixed(1) + "%",
            precision_auto: (metrics.precisionAutoClasificados * 100).toFixed(1) + "%",
            error_silencioso: (metrics.errorSilencioso * 100).toFixed(1) + "%",
            revision_manual: (metrics.revisionManualRate * 100).toFixed(1) + "%",
            clasificados: metrics.clasificados,
        };
    });

    console.log("=== SWEEP DE POLÍTICAS ===");
    console.table(rows);

    // Techo irreducible: casos 5/5 unánimes e incorrectos
    const unanimesErroneos = report.details.filter((d) => {
        const cats = new Set(d.votos.map((v) => v.categoria));
        return cats.size === 1 && d.votos[0].categoria !== d.expected;
    });

    console.log(`\n=== TECHO IRREDUCIBLE ===`);
    console.log(`Casos 5/5 unánimes e incorrectos: ${unanimesErroneos.length} / ${report.details.length}`);
    console.log(`Eso es un piso de error_silencioso de ~${((unanimesErroneos.length / report.details.length) * 100).toFixed(1)}% si todos los demás fueran perfectos.`);

    const unanimesErroneosPorFrontera: Record<string, number> = {};
    for (const d of unanimesErroneos) {
        const key = `${d.expected} → ${d.predicted}`;
        unanimesErroneosPorFrontera[key] = (unanimesErroneosPorFrontera[key] ?? 0) + 1;
    }
    console.log("\nFronteras con casos unánimes erróneos:");
    console.table(unanimesErroneosPorFrontera);

    console.log("\nEjemplos de casos unánimes erróneos:");
    for (const d of unanimesErroneos.slice(0, 10)) {
        console.log(`- ${d.expected} → ${d.predicted}: "${d.text}"`);
    }
    if (unanimesErroneos.length > 10) {
        console.log(`... y ${unanimesErroneos.length - 10} más.`);
    }

    // posibleAgresorPar: OR vs mayoritario
    const orCount = report.details.filter((d) => d.posibleAgresorPar).length;
    const mayoritarioCount = report.details.filter((d) => d.posibleAgresorParMayoritario).length;
    console.log(`\n=== posibleAgresorPar ===`);
    console.log(`Tasa OR-de-5: ${((orCount / report.details.length) * 100).toFixed(1)}%`);
    console.log(`Tasa voto mayoritario: ${((mayoritarioCount / report.details.length) * 100).toFixed(1)}%`);

    // Casos con votos no unánimes (donde secundarias tienen sentido)
    const noUnanimous = report.details.filter((d) => new Set(d.votos.map((v) => v.categoria)).size > 1);
    console.log(`\n=== Contexto para recall de secundarias ===`);
    console.log(`Casos con votos no unánimes: ${noUnanimous.length} / ${report.details.length}`);
    if (noUnanimous.length > 0) {
        const secOk = noUnanimous.filter((d) => d.secundariaCorrecta).length;
        console.log(`Recall de secundarias restringido a no unánimes: ${((secOk / noUnanimous.length) * 100).toFixed(1)}%`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
