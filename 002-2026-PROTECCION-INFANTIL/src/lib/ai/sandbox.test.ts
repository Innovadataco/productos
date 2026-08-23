import { describe, it, expect, vi } from "vitest";
import { logModelosSinRespuesta } from "./sandbox";
import type { VotoRubricaModelo } from "./rubrica";

vi.mock("@/lib/monitoreo/worker-logger", () => ({
    workerLogger: {
        error: vi.fn(),
    },
}));

const { workerLogger } = await import("@/lib/monitoreo/worker-logger");

describe("SPEC-207: log de modelo sin respuesta", () => {
    it("loggear un voto fallback con modelo y latencia", () => {
        const votos: VotoRubricaModelo[] = [
            {
                modelo: "gemma2:27b",
                categorias: {},
                metrics: { modelo: "gemma2:27b", latenciaMs: 0, promptTokens: null, responseTokens: null, totalDuration: null, loadDuration: null },
                fallback: true,
            },
            {
                modelo: "qwen2.5:14b",
                categorias: { SPAM: { cumple: true, preguntasCumplidas: [] } },
                metrics: { modelo: "qwen2.5:14b", latenciaMs: 1200, promptTokens: 100, responseTokens: 50, totalDuration: 1_200_000_000, loadDuration: 0 },
                fallback: false,
            },
        ];

        logModelosSinRespuesta(votos);

        expect(workerLogger.error).toHaveBeenCalledTimes(1);
        expect(workerLogger.error).toHaveBeenCalledWith("Rúbrica: modelo sin respuesta", {
            modelo: "gemma2:27b",
            latenciaMs: 0,
        });
    });

    it("no loggear cuando todos los modelos respondieron", () => {
        const votos: VotoRubricaModelo[] = [
            {
                modelo: "qwen2.5:14b",
                categorias: { SPAM: { cumple: true, preguntasCumplidas: [] } },
                metrics: { modelo: "qwen2.5:14b", latenciaMs: 1200, promptTokens: 100, responseTokens: 50, totalDuration: 1_200_000_000, loadDuration: 0 },
                fallback: false,
            },
        ];

        logModelosSinRespuesta(votos);

        expect(workerLogger.error).not.toHaveBeenCalled();
    });
});
