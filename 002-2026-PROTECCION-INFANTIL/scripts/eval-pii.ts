#!/usr/bin/env tsx
/**
 * Eval F2 — PII determinística + LLM + recall de OTRO vigilado.
 * Uso:
 *   node --env-file=.env --import tsx scripts/eval-pii.ts [fixture.json]
 */
import { detectarPiiDeterministico } from "@/lib/ai/pii-patterns";
import { detectarPiiCombinado } from "@/lib/ai/pii-detector";
import { clasificarReporte } from "@/lib/ai/classifier";
import fs from "fs/promises";
import path from "path";

interface Example {
    text: string;
    contienePii: boolean;
    piiEsperada: string[];
    categoriaEsperada: string;
    ruido: boolean;
}

interface Result {
    text: string;
    expectedPii: boolean;
    expectedPiiFragments: string[];
    expectedCategory: string;
    ruido: boolean;
    deterministic: { contienePii: boolean; piiDetectada: string[] };
    combined: { contienePii: boolean; piiDetectada: string[]; piiDetectadaLLM: string[]; piiDetectadaDeterministica: string[] };
    classification: { categoria: string; estado: string; confidence: number };
    correctPii: boolean;
    correctCategory: boolean;
}

function normalize(s: string): string {
    return s.toLowerCase().replace(/[.,;:!?]+$/, "").trim();
}

function containsAny(haystack: string[], needles: string[]): boolean {
    const normalizedHaystack = haystack.map(normalize);
    return needles.some((n) => normalizedHaystack.includes(normalize(n)));
}

function recallEsperada(detected: string[], expected: string[]): number {
    if (expected.length === 0) return detected.length === 0 ? 1 : 0;
    let found = 0;
    for (const e of expected) {
        if (containsAny(detected, [e])) found++;
    }
    return found / expected.length;
}

async function main() {
    const fixturePath = process.argv[2] || "scripts/eval-pii-fixture.json";
    const raw = await fs.readFile(fixturePath, "utf-8");
    const fixture = JSON.parse(raw);
    const examples: Example[] = fixture.examples;

    console.log(`Evaluando PII sobre ${examples.length} casos...`);

    const results: Result[] = [];

    for (let i = 0; i < examples.length; i++) {
        const ex = examples[i];
        process.stdout.write(`[${i + 1}/${examples.length}] `);

        const deterministic = detectarPiiDeterministico(ex.text);
        const combined = await detectarPiiCombinado("ornith:9b", ex.text);
        const classification = await clasificarReporte("ornith:9b", ex.text);

        const correctPii = combined.contienePii === ex.contienePii;
        const correctCategory = classification.categoria === ex.categoriaEsperada;

        results.push({
            text: ex.text,
            expectedPii: ex.contienePii,
            expectedPiiFragments: ex.piiEsperada,
            expectedCategory: ex.categoriaEsperada,
            ruido: ex.ruido,
            deterministic,
            combined,
            classification: {
                categoria: classification.categoria,
                estado: classification.estado,
                confidence: classification.confianza,
            },
            correctPii,
            correctCategory,
        });

        const tag = correctPii && correctCategory ? "OK" : "FAIL";
        console.log(`${tag} | PII=${combined.contienePii}(${ex.contienePii}) CAT=${classification.categoria}(${ex.categoriaEsperada})`);
    }

    // Métricas PII
    const total = results.length;
    const piiPositives = results.filter((r) => r.expectedPii);
    const piiNegatives = results.filter((r) => !r.expectedPii);

    const detTruePositives = piiPositives.filter((r) => r.deterministic.contienePii).length;
    const detFalsePositives = piiNegatives.filter((r) => r.deterministic.contienePii).length;
    const combinedTruePositives = piiPositives.filter((r) => r.combined.contienePii).length;
    const combinedFalsePositives = piiNegatives.filter((r) => r.combined.contienePii).length;

    const detRecall = piiPositives.length === 0 ? 0 : detTruePositives / piiPositives.length;
    const combinedRecall = piiPositives.length === 0 ? 0 : combinedTruePositives / piiPositives.length;
    const detPrecision = detTruePositives + detFalsePositives === 0 ? 0 : detTruePositives / (detTruePositives + detFalsePositives);
    const combinedPrecision = combinedTruePositives + combinedFalsePositives === 0 ? 0 : combinedTruePositives / (combinedTruePositives + combinedFalsePositives);

    const fragmentRecallDet = results.reduce((sum, r) => sum + recallEsperada(r.deterministic.piiDetectada, r.expectedPiiFragments), 0) / total;
    const fragmentRecallCombined = results.reduce((sum, r) => sum + recallEsperada(r.combined.piiDetectada, r.expectedPiiFragments), 0) / total;
    const fragmentRecallLLM = results.reduce((sum, r) => sum + recallEsperada(r.combined.piiDetectadaLLM, r.expectedPiiFragments), 0) / total;

    // Métricas clasificación (recall OTRO vigilado)
    const otroCases = results.filter((r) => r.expectedCategory === "OTRO");
    const otroRecall = otroCases.length === 0 ? 0 : otroCases.filter((r) => r.correctCategory).length / otroCases.length;
    const categoryAccuracy = results.filter((r) => r.correctCategory).length / total;

    const report = {
        metadata: {
            fixture: fixturePath,
            totalExamples: total,
            timestamp: new Date().toISOString(),
        },
        pii: {
            recallDeterministico: Number(detRecall.toFixed(4)),
            recallCombinado: Number(combinedRecall.toFixed(4)),
            precisionDeterministico: Number(detPrecision.toFixed(4)),
            precisionCombinada: Number(combinedPrecision.toFixed(4)),
            f1Deterministico: Number(((2 * detPrecision * detRecall) / (detPrecision + detRecall || 1)).toFixed(4)),
            f1Combinado: Number(((2 * combinedPrecision * combinedRecall) / (combinedPrecision + combinedRecall || 1)).toFixed(4)),
            falsosPositivosDeterministico: detFalsePositives,
            falsosPositivosCombinado: combinedFalsePositives,
            fragmentRecallDeterministico: Number(fragmentRecallDet.toFixed(4)),
            fragmentRecallCombinado: Number(fragmentRecallCombined.toFixed(4)),
            fragmentRecallLLM: Number(fragmentRecallLLM.toFixed(4)),
        },
        clasificacion: {
            accuracy: Number(categoryAccuracy.toFixed(4)),
            recallOTRO: Number(otroRecall.toFixed(4)),
        },
        details: results,
    };

    const outDir = path.join(process.cwd(), "eval-results");
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `f2-pii-${Date.now()}.json`);
    await fs.writeFile(outFile, JSON.stringify(report, null, 2));

    console.log("\n=== RESUMEN PII F2 ===");
    console.log(`Recall determinístico:       ${(detRecall * 100).toFixed(1)}%`);
    console.log(`Recall combinado:            ${(combinedRecall * 100).toFixed(1)}%`);
    console.log(`Precision determinística:    ${(detPrecision * 100).toFixed(1)}%`);
    console.log(`Precision combinada:         ${(combinedPrecision * 100).toFixed(1)}%`);
    console.log(`Falsos positivos det:        ${detFalsePositives}`);
    console.log(`Falsos positivos combinado:  ${combinedFalsePositives}`);
    console.log(`Fragment recall det:         ${(fragmentRecallDet * 100).toFixed(1)}%`);
    console.log(`Fragment recall combinado:   ${(fragmentRecallCombined * 100).toFixed(1)}%`);
    console.log(`Fragment recall LLM:         ${(fragmentRecallLLM * 100).toFixed(1)}%`);
    console.log("\n=== CLASIFICACIÓN VIGILADA ===");
    console.log(`Accuracy categoría:          ${(categoryAccuracy * 100).toFixed(1)}%`);
    console.log(`Recall OTRO:                 ${(otroRecall * 100).toFixed(1)}%`);
    console.log(`\nReporte guardado en: ${outFile}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
