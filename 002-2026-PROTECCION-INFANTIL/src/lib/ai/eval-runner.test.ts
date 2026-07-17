import { describe, it, expect } from "vitest";
import { computePerCategoryMetrics, computeMetrics, type EvalResultArm } from "./eval-runner";

function makeResult(expected: string, predicted: string, estado = "CLASIFICADO"): EvalResultArm {
    return {
        text: "",
        expected: expected as EvalResultArm["expected"],
        predicted: predicted as EvalResultArm["predicted"],
        confidence: 0.9,
        estado,
        latencyMs: 100,
        correct: expected === predicted,
        ruido: false,
        fallback: false,
        posibleAgresorPar: false,
        guardaDoxing: false,
        guardaDoxingVerdadera: false,
        guardaKeywords: false,
        keywordsDetectadas: [],
        prioridadAlta: false,
    };
}

describe("computePerCategoryMetrics", () => {
    it("calculates precision, recall and f1 per category", () => {
        const results: EvalResultArm[] = [
            makeResult("OTRO", "OTRO"),
            makeResult("OTRO", "OTRO"),
            makeResult("OTRO", "DOXING"),
            makeResult("DOXING", "DOXING"),
            makeResult("DOXING", "OTRO"),
        ];

        const perCategory = computePerCategoryMetrics(results);
        expect(perCategory.OTRO.precision).toBe(2 / 3);
        expect(perCategory.OTRO.recall).toBe(2 / 3);
        expect(perCategory.DOXING.precision).toBe(0.5);
        expect(perCategory.DOXING.recall).toBe(0.5);
    });
});

describe("computeMetrics", () => {
    it("computes silent error from auto-classified samples", () => {
        const results: EvalResultArm[] = [
            makeResult("OTRO", "OTRO", "CLASIFICADO"),
            makeResult("DOXING", "OTRO", "CLASIFICADO"),
            makeResult("OTRO", "OTRO", "REVISION_MANUAL"),
        ];

        const metrics = computeMetrics(results);
        expect(metrics.errorSilencioso).toBe(0.5);
        expect(metrics.revisionManualRate).toBe(1 / 3);
    });
});
