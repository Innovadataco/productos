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

    describe("prompt de sistema (smoke tests)", () => {
        function getSystemPromptFromCall(): string {
            expect(mockLlamar).toHaveBeenCalled();
            const call = mockLlamar.mock.calls[0];
            return String(call[3]);
        }

        it("establece la regla de prioridad SOLICITUD_MATERIAL sobre OFRECIMIENTO_REGALOS", async () => {
            mockLlamar.mockResolvedValue(mockResponse("SOLICITUD_MATERIAL", 0.9, false));
            await clasificarReporte("ornith:9b", "te doy dinero si me mandas fotos", 0.5);
            const systemPrompt = getSystemPromptFromCall();
            expect(systemPrompt).toContain("prevalece SOLICITUD_MATERIAL");
            expect(systemPrompt).toContain('"te compro un celular si me mandas fotos" → SOLICITUD_MATERIAL');
            expect(systemPrompt).toContain('"te doy dinero si me describís tu cuerpo" → SOLICITUD_MATERIAL');
        });

        it("mantiene OFRECIMIENTO_REGALOS cuando no hay solicitud de material íntimo", async () => {
            mockLlamar.mockResolvedValue(mockResponse("OFRECIMIENTO_REGALOS", 0.9, false));
            await clasificarReporte("ornith:9b", "te regalo skins si me seguís", 0.5);
            const systemPrompt = getSystemPromptFromCall();
            expect(systemPrompt).toContain('"te regalo skins si me seguís y hablamos" → OFRECIMIENTO_REGALOS');
        });

        it("amplía CONTACTO_INSISTENTE con señales de grooming temprano", async () => {
            mockLlamar.mockResolvedValue(mockResponse("CONTACTO_INSISTENTE", 0.9, false));
            await clasificarReporte("ornith:9b", "hola cuántos años tenés, hablemos por privado", 0.5);
            const systemPrompt = getSystemPromptFromCall();
            expect(systemPrompt).toContain("grooming temprano");
            expect(systemPrompt).toContain("pedir que la conversación se mantenga en secreto");
            expect(systemPrompt).toContain("insistir en pasar a chat privado");
            expect(systemPrompt).toContain('"Hola, ¿cuántos años tenés? ¿en qué curso estás? Hablame por privado, no le digas a tus papás" → CONTACTO_INSISTENTE');
        });

        it("distingue pregunta casual (OTRO) de grooming temprano (CONTACTO_INSISTENTE)", async () => {
            mockLlamar.mockResolvedValue(mockResponse("OTRO", 0.9, false));
            await clasificarReporte("ornith:9b", "¿qué edad tenés? yo tengo 13", 0.5);
            const systemPrompt = getSystemPromptFromCall();
            expect(systemPrompt).toContain("una pregunta casual sin contexto de riesgo no basta");
            expect(systemPrompt).toContain('"¿qué edad tenés? yo tengo 13" → OTRO');
        });

        it("no altera las otras 10 categorías (ejemplo: extorsión y encuentro intactos)", async () => {
            mockLlamar.mockResolvedValue(mockResponse("EXTORSION", 0.9, false));
            await clasificarReporte("ornith:9b", "si no me mandas fotos, le cuento a todos", 0.5);
            const systemPrompt = getSystemPromptFromCall();
            expect(systemPrompt).toContain('"si no me mandas fotos, le cuento a todos" → EXTORSION');
            expect(systemPrompt).toContain("SOLICITUD_ENCUENTRO: solicitud de reunión física");
            expect(systemPrompt).toContain("SUPLANTACION_IDENTIDAD: fingir ser menor");
        });
    });
});
