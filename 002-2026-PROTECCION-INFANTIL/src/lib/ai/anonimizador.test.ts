import { describe, it, expect, vi } from "vitest";
import { anonimizarTexto } from "./anonimizador";

const mockLlamarOllamaStructured = vi.fn();

vi.mock("./ollama-client", () => ({
    llamarOllamaStructured: (...args: unknown[]) => mockLlamarOllamaStructured(...args),
}));

function mockResponse(texto: string, pii: string[]) {
    return {
        data: { texto_anonimizado: texto, pii_detectada: pii },
        rawResponse: JSON.stringify({ texto_anonimizado: texto, pii_detectada: pii }),
        metrics: { modelo: "ornith:9b", latenciaMs: 0, promptTokens: null, responseTokens: null, totalDuration: null },
    };
}

describe("anonimizarTexto", () => {
    it("reemplaza fragmentos obligatorios aunque el LLM los omita", async () => {
        mockLlamarOllamaStructured.mockResolvedValue(
            mockResponse("El menor vive en [DIRECCION] y su celular es 3001234567", [])
        );

        const r = await anonimizarTexto("ornith:9b", "El menor vive en carrera 45 # 12-34 y su celular es 3001234567", [
            "carrera 45 # 12-34",
            "3001234567",
        ]);

        expect(r.textoAnonimizado).toContain("[DIRECCION]");
        expect(r.textoAnonimizado).not.toContain("carrera 45");
        expect(r.textoAnonimizado).toContain("[TELEFONO]");
        expect(r.textoAnonimizado).not.toContain("3001234567");
        expect(r.piiDetectada).toContain("carrera 45 # 12-34");
        expect(r.piiDetectada).toContain("3001234567");
    });

    it("combina fragmentos obligatorios con PII adicional detectado por el LLM", async () => {
        mockLlamarOllamaStructured.mockResolvedValue(
            mockResponse("Mi hijo [NOMBRE] estudia en el colegio San José", ["Juan"])
        );

        const r = await anonimizarTexto("ornith:9b", "Mi hijo Juan estudia en el colegio San José", ["Juan"]);

        expect(r.piiDetectada).toContain("Juan");
    });
});
