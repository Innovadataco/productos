import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { unmockPrisma } from "@/lib/test-mocks/unmock-prisma";
import {
    clasificarConRubrica,
    calcularPorcentajes,
    resolverPresentesYPrincipal,
    generarAnalisisRubrica,
    cumpleCategoria,
    filtrarYTraducirIndices,
    indicesDecisivas,
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

afterAll(() => unmockPrisma());

const CONFIG_TEST = {
    enabled: true,
    preguntas: {
        SOLICITUD_ENCUENTRO: [{ texto: "¿Alguien propone verse?", activo: true, tipo: "decisiva" as const }],
        CONTACTO_INSISTENTE: [{ texto: "¿Hay mensajes repetidos?", activo: true, tipo: "decisiva" as const }],
        OFRECIMIENTO_REGALOS: [{ texto: "¿Se ofrece algo de valor?", activo: true, tipo: "decisiva" as const }],
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

const PREGUNTAS_TEST: Record<string, string> = {
    SOLICITUD_ENCUENTRO: "¿Alguien propone verse?",
    CONTACTO_INSISTENTE: "¿Hay mensajes repetidos?",
    OFRECIMIENTO_REGALOS: "¿Se ofrece algo de valor?",
};

function respuestaVotoConIndices(categorias: Record<string, number[]>) {
    return {
        data: {
            categorias: Object.fromEntries(
                Object.entries(categorias).map(([cat, indices]) => [
                    cat,
                    { cumple: indices.length > 0 ? 1 : 0, preguntasCumplidas: indices },
                ])
            ),
        },
        rawResponse: "{}",
        metrics: { modelo: "m", latenciaMs: 10, promptTokens: 1, responseTokens: 1, totalDuration: 10, loadDuration: null },
    };
}

function respuestaVoto(cumplimientos: Record<string, boolean>) {
    return {
        data: {
            categorias: Object.fromEntries(
                Object.entries(cumplimientos).map(([cat, cumple]) => [
                    cat,
                    // Spec 104: el modelo devuelve ÍNDICES (1-based), no textos.
                    { cumple: cumple ? 1 : 0, preguntasCumplidas: cumple ? [1] : [] },
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
        // Spec 098: `categoria` (uso interno) = la de MAYOR GRAVEDAD entre las presentes
        // (SOLICITUD_ENCUENTRO), aunque CONTACTO_INSISTENTE tenga mayor % (100%).
        // La presentación sigue mostrando todas (D-13); severidades = defaults (mock null).
        expect(res.categoria).toBe("SOLICITUD_ENCUENTRO");
        expect(res.confianza).toBeCloseTo(2 / 3);
        expect(res.categoriasPresentes).toContain("SOLICITUD_ENCUENTRO");
        expect(res.estado).toBe("CLASIFICADO");
        // Con SOLICITUD_ENCUENTRO como principal, la secundaria es CONTACTO_INSISTENTE
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

    it("embudo vacío → red de seguridad evalúa todas las categorías (spec 092-US2) y sigue sin presentes", async () => {
        mockLlamar.mockResolvedValueOnce(respuestaEmbudo([]));
        // Los 3 modelos votan "no cumple" en todas
        for (let i = 0; i < 3; i++) {
            mockLlamar.mockResolvedValueOnce(respuestaVoto({ SOLICITUD_ENCUENTRO: false, CONTACTO_INSISTENTE: false, OFRECIMIENTO_REGALOS: false }));
        }

        const res = await clasificarConRubrica("texto sin señal", CONFIG_TEST);

        // Con la red de seguridad (plausibles < 2 → todas), se llama embudo + 3 modelos
        expect(mockLlamar).toHaveBeenCalledTimes(4);
        expect(res.categoriasPresentes).toEqual([]);
        expect(res.categoria).toBe("OTRO");
        expect(res.estado).toBe("REVISION_MANUAL");
    });
});

// Spec 104: votación por ÍNDICES — el cumplimiento no depende del formato del texto.
describe("spec 104 — cumplimiento por índices (adiós verbatim)", () => {
    const SETS = {
        GROOMING: [
            { texto: "¿Se ofrece algo de valor?", activo: true, tipo: "decisiva" as const },
            { texto: "¿El ofrecimiento es personal, dirigido específicamente a este menor?", activo: true, tipo: "decisiva" as const },
            { texto: "¿Viene de un adulto o desconocido?", activo: true },
        ],
        BENIGNA: [{ texto: "¿Es de día?", activo: true }],
    };

    it("cumpleCategoria: todas las decisivas presentes por índice → true; falta una → false", () => {
        expect(cumpleCategoria(SETS, "GROOMING", [1, 2], true)).toBe(true);
        expect(cumpleCategoria(SETS, "GROOMING", [1], true)).toBe(false);
        expect(cumpleCategoria(SETS, "GROOMING", [2], true)).toBe(false);
        expect(cumpleCategoria(SETS, "GROOMING", [1, 2], false)).toBe(false);
        // Sin decisivas activas: basta el 0/1 del modelo
        expect(cumpleCategoria(SETS, "BENIGNA", [], true)).toBe(true);
    });

    it("indicesDecisivas: posiciones 1-based dentro del set activo", () => {
        expect(indicesDecisivas(SETS, "GROOMING")).toEqual([1, 2]);
        expect(indicesDecisivas(SETS, "BENIGNA")).toEqual([]);
    });

    it("filtrarYTraducirIndices: fuera de rango y duplicados descartados; textos canónicos", () => {
        const { validos, textos } = filtrarYTraducirIndices(SETS, "GROOMING", [1, 99, 1, -3, 3, 0]);
        expect(validos).toEqual([1, 3]);
        expect(textos).toEqual(["¿Se ofrece algo de valor?", "¿Viene de un adulto o desconocido?"]);
    });

    it("ACEPTACIÓN B1: el resultado no depende del formato — índices con ruido (duplicados/fuera de rango) dan el MISMO veredicto", async () => {
        // El modo viejo (verbatim) moría con "1. [DECISIVA] …" o sin "¿": el modelo
        // entendía pero la cadena no coincidía. Con índices, el texto ya no participa.
        const config = { ...CONFIG_TEST, preguntas: SETS };
        for (const indices of [[1, 2], [1, 2, 99, 1], [2, 1]]) {
            mockLlamar.mockReset();
            mockParametroFindUnique.mockResolvedValue(null);
            mockLlamar.mockResolvedValueOnce(respuestaEmbudo(["GROOMING"]));
            for (let m = 0; m < 3; m++) {
                mockLlamar.mockResolvedValueOnce(respuestaVotoConIndices({ GROOMING: indices }));
            }
            const res = await clasificarConRubrica("texto con señal", config);
            expect(res.categoriasPresentes).toEqual(["GROOMING"]);
            expect(res.estado).toBe("CLASIFICADO");
            // Persistencia: textos CANÓNICOS (traducidos desde índice), no los del modelo
            for (const v of res.votosModelos) {
                expect(v.categorias.GROOMING.preguntasCumplidas).toEqual([
                    "¿Se ofrece algo de valor?",
                    "¿El ofrecimiento es personal, dirigido específicamente a este menor?",
                ]);
            }
        }
    });

    it("índice de decisiva ausente en 2/3 modelos → no presente (bloqueo decisivo intacto)", async () => {
        const config = { ...CONFIG_TEST, preguntas: SETS };
        mockLlamar.mockResolvedValueOnce(respuestaEmbudo(["GROOMING"]));
        mockLlamar.mockResolvedValueOnce(respuestaVotoConIndices({ GROOMING: [1, 2] }));
        mockLlamar.mockResolvedValueOnce(respuestaVotoConIndices({ GROOMING: [1] })); // falta decisiva 2
        mockLlamar.mockResolvedValueOnce(respuestaVotoConIndices({ GROOMING: [1] }));

        const res = await clasificarConRubrica("texto con señal", config);
        // Solo 1/3 cumple todas las decisivas → 0.33 < 0.6 → no presente
        expect(res.categoriasPresentes).toEqual([]);
        expect(res.estado).toBe("REVISION_MANUAL");
    });
});
