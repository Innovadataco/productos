import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    clasificarConRubrica,
    calcularPorcentajes,
    resolverPresentesYPrincipal,
    generarAnalisisRubrica,
    type VotoRubricaModelo,
} from "./rubrica";

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

const CONFIG_TEST = {
    enabled: true,
    preguntas: {
        SOLICITUD_ENCUENTRO: [{ texto: "¿Alguien propone verse?", activo: true }],
        CONTACTO_INSISTENTE: [{ texto: "¿Hay mensajes repetidos?", activo: true }],
        OFRECIMIENTO_REGALOS: [{ texto: "¿Se ofrece algo de valor?", activo: true }],
    },
    modelos: ["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"],
    temperatura: 0.2,
    umbralPresencia: 0.6,
    modeloEmbudo: "qwen2.5:14b",
};

function respuestaEmbudo(categorias: string[]) {
    return {
        data: { categoriasPlausibles: categorias },
        rawResponse: "{}",
        metrics: { modelo: "qwen2.5:14b", latenciaMs: 10, promptTokens: 1, responseTokens: 1, totalDuration: 10, loadDuration: null },
    };
}

function respuestaVoto(cumplimientos: Record<string, boolean>) {
    return {
        data: {
            categorias: Object.fromEntries(
                Object.entries(cumplimientos).map(([cat, cumple]) => [
                    cat,
                    { cumple: cumple ? 1 : 0, preguntasCumplidas: cumple ? ["pregunta 1"] : [] },
                ])
            ),
        },
        rawResponse: "{}",
        metrics: { modelo: "m", latenciaMs: 10, promptTokens: 1, responseTokens: 1, totalDuration: 10, loadDuration: null },
    };
}

function votoModelo(modelo: string, categorias: Record<string, boolean>, fallback = false): VotoRubricaModelo {
    return {
        modelo,
        categorias: Object.fromEntries(
            Object.entries(categorias).map(([cat, cumple]) => [cat, { cumple, preguntasCumplidas: [] }])
        ),
        metrics: { modelo, latenciaMs: 1, promptTokens: 1, responseTokens: 1, totalDuration: 1, loadDuration: null },
        fallback,
    };
}

describe("rúbrica — agregación pura", () => {
    it("% por categoría = modelos que marcaron 1 / N", () => {
        const votos = [
            votoModelo("m1", { A: true, B: false }),
            votoModelo("m2", { A: true, B: true }),
            votoModelo("m3", { A: false, B: true }),
        ];
        const pct = calcularPorcentajes(votos, ["A", "B"]);
        expect(pct.A).toBeCloseTo(2 / 3);
        expect(pct.B).toBeCloseTo(2 / 3);
    });

    it("votos fallback no cuentan en el denominador", () => {
        const votos = [votoModelo("m1", { A: true }), votoModelo("m2", {}, true)];
        expect(calcularPorcentajes(votos, ["A"]).A).toBe(1);
    });

    it("umbral de presencia filtra categorías (subir/bajar cambia cuántas aparecen)", () => {
        const pct = { A: 1, B: 2 / 3, C: 1 / 3 };
        const sev = { A: 90, B: 80, C: 30 };
        expect(resolverPresentesYPrincipal(pct, 0.6, sev).presentes).toEqual(["A", "B"]);
        expect(resolverPresentesYPrincipal(pct, 0.9, sev).presentes).toEqual(["A"]);
        expect(resolverPresentesYPrincipal(pct, 0.3, sev).presentes).toEqual(["A", "B", "C"]);
    });

    it("principal = la de mayor gravedad entre las presentes", () => {
        const pct = { CONTACTO_INSISTENTE: 1, SOLICITUD_ENCUENTRO: 2 / 3 };
        const sev = { CONTACTO_INSISTENTE: 30, SOLICITUD_ENCUENTRO: 90 };
        const { principal } = resolverPresentesYPrincipal(pct, 0.6, sev);
        expect(principal).toBe("SOLICITUD_ENCUENTRO");
    });

    it("plantilla de análisis: determinista y describe el acuerdo", () => {
        const votos = [votoModelo("m1", { A: true, B: false }), votoModelo("m2", { A: true, B: true }), votoModelo("m3", { A: true, B: false })];
        const pct = calcularPorcentajes(votos, ["A", "B"]);
        const analisis = generarAnalisisRubrica(votos, pct, 0.6);
        expect(analisis).toContain("Acuerdo total (3/3) en A");
        expect(analisis).toContain("Acuerdo parcial (1/3) en B");
        expect(generarAnalisisRubrica(votos, { A: 0, B: 0 }, 0.6)).toContain("revisión humana");
    });
});

describe("clasificarConRubrica — flujo completo (mocks)", () => {
    beforeEach(() => {
        mockLlamar.mockReset();
        mockParametroFindUnique.mockReset();
        mockParametroFindUnique.mockResolvedValue(null); // severidades = defaults del código
    });

    it("matriz 0/1 por modelo persistida en votosModelos; principal por gravedad", async () => {
        mockLlamar.mockResolvedValueOnce(respuestaEmbudo(["SOLICITUD_ENCUENTRO", "CONTACTO_INSISTENTE"]));
        mockLlamar.mockResolvedValueOnce(respuestaVoto({ SOLICITUD_ENCUENTRO: true, CONTACTO_INSISTENTE: true })); // gemma
        mockLlamar.mockResolvedValueOnce(respuestaVoto({ SOLICITUD_ENCUENTRO: true, CONTACTO_INSISTENTE: true })); // qwen
        mockLlamar.mockResolvedValueOnce(respuestaVoto({ SOLICITUD_ENCUENTRO: false, CONTACTO_INSISTENTE: true })); // aya

        const res = await clasificarConRubrica("texto con señal", CONFIG_TEST);

        expect(res.votosModelos).toHaveLength(3);
        expect(res.votosModelos[0].categorias.SOLICITUD_ENCUENTRO.cumple).toBe(true);
        expect(res.porcentajes.SOLICITUD_ENCUENTRO).toBeCloseTo(2 / 3);
        expect(res.porcentajes.CONTACTO_INSISTENTE).toBe(1);
        // Gravedad: SOLICITUD_ENCUENTRO (90) > CONTACTO_INSISTENTE (30)
        expect(res.categoria).toBe("SOLICITUD_ENCUENTRO");
        expect(res.estado).toBe("CLASIFICADO");
        expect(res.categoriasSecundarias.map((c) => c.categoria)).toContain("CONTACTO_INSISTENTE");
    });

    it("ninguna supera el umbral → REVISION_MANUAL (desacuerdo entre modelos)", async () => {
        mockLlamar.mockResolvedValueOnce(respuestaEmbudo(["SOLICITUD_ENCUENTRO", "CONTACTO_INSISTENTE"]));
        mockLlamar.mockResolvedValueOnce(respuestaVoto({ SOLICITUD_ENCUENTRO: true, CONTACTO_INSISTENTE: false }));
        mockLlamar.mockResolvedValueOnce(respuestaVoto({ SOLICITUD_ENCUENTRO: false, CONTACTO_INSISTENTE: true }));
        mockLlamar.mockResolvedValueOnce(respuestaVoto({ SOLICITUD_ENCUENTRO: false, CONTACTO_INSISTENTE: false }));

        const res = await clasificarConRubrica("texto ambiguo", CONFIG_TEST);

        // 1/3 en ambas < 0.6 → ninguna presente
        expect(res.categoriasPresentes).toEqual([]);
        expect(res.categoria).toBe("OTRO");
        expect(res.estado).toBe("REVISION_MANUAL");
    });

    it("embudo sin plausibles → OTRO → revisión, sin llamadas a los modelos", async () => {
        mockLlamar.mockResolvedValueOnce(respuestaEmbudo([]));

        const res = await clasificarConRubrica("texto sin señal", CONFIG_TEST);

        expect(mockLlamar).toHaveBeenCalledTimes(1);
        expect(res.categoria).toBe("OTRO");
        expect(res.estado).toBe("REVISION_MANUAL");
    });
});
