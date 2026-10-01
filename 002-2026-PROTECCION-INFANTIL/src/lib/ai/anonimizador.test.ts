import { describe, it, expect, vi } from "vitest";
import { anonimizarTexto } from "./anonimizador";
import { AnonimizacionRechazadaError, AnonimizacionTransporteError } from "./anonimizacion-errores";

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

// SPEC-807 · El gancho de los errores tipados: hoy `anonimizarTexto` lanzaba un Error GENÉRICO tanto por
// transporte (Ollama caído) como por rechazo deliberado (resultado inusable), y `derivar` los fundía. Sin
// distinguirlos, cualquier marca de reintento miente (transporte sí, rechazo no). Este candado afirma que
// el LLAMADOR los recibe como tipos DISTINTOS. Sin él, el tipo existiría y nadie lo usaría.
describe("SPEC-807 · el llamador recibe los dos fallos DISTINTOS (transporte ≠ rechazo)", () => {
    const TEXTO = "Un texto de reporte suficientemente largo para la prueba del gancho";

    it("TRANSPORTE: si falla la llamada a Ollama (caído/timeout) → AnonimizacionTransporteError", async () => {
        mockLlamarOllamaStructured.mockRejectedValue(new Error("fetch failed"));
        await expect(anonimizarTexto("ornith:9b", TEXTO)).rejects.toBeInstanceOf(AnonimizacionTransporteError);
    });

    it("RECHAZO: si la anonimización da un resultado inusable (demasiado corto) → AnonimizacionRechazadaError", async () => {
        mockLlamarOllamaStructured.mockResolvedValue(mockResponse("corto", []));
        await expect(anonimizarTexto("ornith:9b", TEXTO)).rejects.toBeInstanceOf(AnonimizacionRechazadaError);
    });

    it("son MUTUAMENTE distinguibles — el llamador decide «¿reintento?» sin adivinar (transporte sí, rechazo no)", async () => {
        mockLlamarOllamaStructured.mockRejectedValue(new Error("fetch failed"));
        const transporte = await anonimizarTexto("ornith:9b", TEXTO).catch((e) => e);
        mockLlamarOllamaStructured.mockReset().mockResolvedValue(mockResponse("corto", []));
        const rechazo = await anonimizarTexto("ornith:9b", TEXTO).catch((e) => e);

        expect(transporte).toBeInstanceOf(AnonimizacionTransporteError);
        expect(rechazo).toBeInstanceOf(AnonimizacionRechazadaError);
        // La prueba de que NO se fundieron: cada uno NO es del otro tipo.
        expect(transporte instanceof AnonimizacionRechazadaError).toBe(false);
        expect(rechazo instanceof AnonimizacionTransporteError).toBe(false);
    });
});
