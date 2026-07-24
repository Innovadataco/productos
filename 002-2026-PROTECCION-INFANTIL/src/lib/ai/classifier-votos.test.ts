import { describe, it, expect, vi, beforeEach } from "vitest";
import { clasificarConVotos } from "./classifier";

const mockLlamar = vi.fn();
const mockParametroFindUnique = vi.hoisted(() => vi.fn());

vi.mock("./ollama-client", () => ({
    llamarOllamaStructured: (...args: unknown[]) => mockLlamar(...args),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        parametroSistema: {
            findUnique: (...args: unknown[]) => mockParametroFindUnique(...args),
        },
    },
}));

function voto(categoria: string, confianza: number) {
    return {
        data: { categoria, confianza, posible_agresor_par: false },
        rawResponse: "{}",
        metrics: { modelo: "m", latenciaMs: 10, promptTokens: 1, responseTokens: 1, totalDuration: 10 },
    };
}

describe("clasificarConVotos — spec 089 (US2)", () => {
    beforeEach(() => {
        mockLlamar.mockReset();
        mockParametroFindUnique.mockReset();
        mockParametroFindUnique.mockResolvedValue(null); // severidad = defaults del código
    });

    it("US2a: OTRO unánime con confianza total SIEMPRE va a REVISION_MANUAL", async () => {
        for (let i = 0; i < 5; i++) mockLlamar.mockResolvedValueOnce(voto("OTRO", 1.0));

        const res = await clasificarConVotos("m", "texto ambiguo sin conducta clara", { nVotos: 5 });

        expect(res.categoria).toBe("OTRO");
        expect(res.estado).toBe("REVISION_MANUAL");
    });

    it("US2b: la conducta líder es la de MAYOR GRAVEDAD, no la más votada", async () => {
        // 3 votos CONTACTO_INSISTENTE (sev 30) vs 2 votos SOLICITUD_ENCUENTRO (sev 90)
        for (let i = 0; i < 3; i++) mockLlamar.mockResolvedValueOnce(voto("CONTACTO_INSISTENTE", 0.9));
        for (let i = 0; i < 2; i++) mockLlamar.mockResolvedValueOnce(voto("SOLICITUD_ENCUENTRO", 0.9));

        const res = await clasificarConVotos("m", "texto con señal grave minoritaria", { nVotos: 5 });

        expect(res.categoria).toBe("SOLICITUD_ENCUENTRO");
        // La confianza del líder (2/5) queda por debajo del umbral → revisión humana, no auto-publicación como leve
        expect(res.confianza).toBeCloseTo(0.4);
        expect(res.estado).toBe("REVISION_MANUAL");
        // La categoría leve queda como secundaria
        expect(res.categoriasSecundarias?.some((c) => c.categoria === "CONTACTO_INSISTENTE")).toBe(true);
    });

    it("US2b: a igualdad de severidad gana el más votado", async () => {
        for (let i = 0; i < 4; i++) mockLlamar.mockResolvedValueOnce(voto("CONTACTO_INSISTENTE", 0.9));
        mockLlamar.mockResolvedValueOnce(voto("OTRO", 0.5));

        const res = await clasificarConVotos("m", "texto de contacto insistente", { nVotos: 5 });

        expect(res.categoria).toBe("CONTACTO_INSISTENTE");
    });
});
