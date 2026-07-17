import { describe, it, expect, vi, beforeEach } from "vitest";
import { clasificarReporte } from "./classifier";

const mockLlamar = vi.fn();

vi.mock("./ollama-client", () => ({
    llamarOllamaStructured: (...args: unknown[]) => mockLlamar(...args),
}));

function mockResponse(categoria: string, confianza: number, posibleAgresorPar: boolean) {
    return {
        data: { categoria, confianza, posible_agresor_par: posibleAgresorPar },
        rawResponse: "{}",
        metrics: { modelo: "ornith:9b", latenciaMs: 100, promptTokens: 10, responseTokens: 5, totalDuration: 100 },
    };
}

describe("clasificarReporte", () => {
    beforeEach(() => {
        mockLlamar.mockReset();
    });

    it("devuelve categoría principal, confianza y posibleAgresorPar", async () => {
        mockLlamar.mockResolvedValue(mockResponse("SOLICITUD_MATERIAL", 0.85, false));

        const res = await clasificarReporte("ornith:9b", "texto de prueba", 0.5);

        expect(res.categoria).toBe("SOLICITUD_MATERIAL");
        expect(res.confianza).toBe(0.85);
        expect(res.posibleAgresorPar).toBe(false);
        expect(res.estado).toBe("CLASIFICADO");
    });

    it("devuelve REVISION_MANUAL cuando la confianza está por debajo del umbral", async () => {
        mockLlamar.mockResolvedValue(mockResponse("OTRO", 0.4, false));

        const res = await clasificarReporte("ornith:9b", "texto ambiguo", 0.5);

        expect(res.categoria).toBe("OTRO");
        expect(res.estado).toBe("REVISION_MANUAL");
    });

    it("detecta posible agresor par", async () => {
        mockLlamar.mockResolvedValue(mockResponse("CONTACTO_INSISTENTE", 0.8, true));

        const res = await clasificarReporte("ornith:9b", "mi compañero del colegio me escribe todo el tiempo", 0.5);

        expect(res.posibleAgresorPar).toBe(true);
    });

    it("normaliza categorías inválidas a OTRO", async () => {
        mockLlamar.mockResolvedValue(mockResponse("CATEGORIA_INVALIDA", 0.9, false));

        const res = await clasificarReporte("ornith:9b", "texto", 0.5);

        expect(res.categoria).toBe("OTRO");
    });

    it("usa fallback cuando structured output falla", async () => {
        mockLlamar.mockRejectedValue(new Error("Ollama timeout"));

        const res = await clasificarReporte("ornith:9b", "texto", 0.5);

        expect(res.categoria).toBe("OTRO");
        expect(res.fallback).toBe(true);
        expect(res.estado).toBe("REVISION_MANUAL");
        expect(res.posibleAgresorPar).toBe(false);
    });
});
