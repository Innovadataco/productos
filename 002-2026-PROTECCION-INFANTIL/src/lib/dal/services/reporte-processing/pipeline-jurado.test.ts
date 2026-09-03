/**
 * SPEC-398 (I-286) — Candado permanente del jurado del pipeline real.
 *
 * El bug que este test caza vivió 6 días en producción sin que nada chillara.
 * `52accefcf` (28-08) hizo que `clasificarReporte` pasara SIEMPRE
 * `parametros.modeloClasificacion` al motor. Como ese campo nunca es vacío
 * (cae al parámetro legado `reportes.classification_model` o al default), el
 * motor tomaba SIEMPRE la rama de override y `rubrica.ts:296` colapsaba el
 * comité de tres modelos a uno.
 *
 * Un test que solo mira "hay un `+` en `modeloUsado`" se puede engañar; este
 * mide la SEMÁNTICA: sin override, el motor recibe `{}` (jurado completo). Con
 * override explícito, recibe `{modeloClasificacion: X}`. Es la contra-prueba
 * de la regresión de 6 días: con este candado en su lugar, el 52accefcf
 * habría muerto en CI.
 *
 * Complementario: el candado operativo vive en `inicio-admin.ts`
 * (senalJuradoReducido) — la prueba vigila el código, la señal vigila la
 * realidad (ver mensaje del CEO idc-14 · 2026-09-03 12:25).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    clasificarConMotorActivo: vi.fn(),
    detectarPiiCombinado: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    createManyVotos: vi.fn(),
}));

vi.mock("@/lib/ai/motor", () => ({
    clasificarConMotorActivo: mocks.clasificarConMotorActivo,
}));

vi.mock("@/lib/ai/pii-detector", () => ({
    detectarPiiCombinado: mocks.detectarPiiCombinado,
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        clasificacionIA: {
            findUnique: mocks.findUnique,
            create: mocks.create,
        },
        clasificacionRubricaVoto: {
            createMany: mocks.createManyVotos,
        },
    },
}));

import { clasificarReporte } from "./clasificacion";
import type { ParametrosClasificacion } from "./parametros";

function parametrosBase(overrides: Partial<ParametrosClasificacion> = {}): ParametrosClasificacion {
    return {
        modeloEmbedding: "bge-m3:latest",
        modeloClasificacion: "gemma2:27b",
        modeloAnonimizacion: "gemma2:27b",
        overrideModeloClasificacion: undefined,
        umbralRevision: 1.0,
        nVotos: 5,
        temperaturaVotos: 0.7,
        minScoreCategoria: 0.3,
        ollamaNumParallel: 2,
        modeloDesempate: undefined,
        umbralSpam: 0.7,
        rafagaN: 3,
        rafagaHoras: 24,
        ragTopK: 3,
        ...overrides,
    };
}

function resultadoRubricaTresModelos() {
    return {
        categoria: "EXTORSION" as const,
        confianza: 1,
        categoriasSecundarias: [],
        posibleAgresorPar: false,
        estado: "CLASIFICADO" as const,
        metrics: { modelo: "rubrica:gemma2:27b+qwen2.5:14b+aya-expanse:32b", latenciaMs: 200, promptTokens: 10, responseTokens: 20 },
        rawResponse: "raw",
        votos: [],
        rubrica: {
            votosModelos: [
                { modelo: "gemma2:27b", categorias: { EXTORSION: { cumple: true, preguntasCumplidas: [] } } },
                { modelo: "qwen2.5:14b", categorias: { EXTORSION: { cumple: true, preguntasCumplidas: [] } } },
                { modelo: "aya-expanse:32b", categorias: { EXTORSION: { cumple: false, preguntasCumplidas: [] } } },
            ],
        },
        fallback: false,
    };
}

describe("clasificarReporte — candado del jurado del pipeline real (SPEC-398 · I-286)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findUnique.mockResolvedValue(null); // no hay clasificación previa
        mocks.detectarPiiCombinado.mockResolvedValue({
            contienePii: false,
            piiDetectada: [],
            metrics: { latenciaMs: 10 },
        });
        mocks.clasificarConMotorActivo.mockResolvedValue(resultadoRubricaTresModelos());
        mocks.create.mockResolvedValue({ id: "cid-1" });
        mocks.createManyVotos.mockResolvedValue({ count: 3 });
    });

    // ── EL CANDADO ─────────────────────────────────────────────────────────
    it("sin override → llama a `clasificarConMotorActivo` con OPCIONES VACÍAS (jurado completo)", async () => {
        await clasificarReporte({
            reporteId: "r1",
            texto: "texto de prueba",
            parametros: parametrosBase(), // overrideModeloClasificacion=undefined
            ejemplosRag: [],
        });

        expect(mocks.clasificarConMotorActivo).toHaveBeenCalledTimes(1);
        const [, opciones] = mocks.clasificarConMotorActivo.mock.calls[0]!;
        // Este es el candado: SIN override, el segundo argumento NO puede
        // llevar `modeloClasificacion` — si lo lleva, el motor toma la rama
        // de override y el jurado colapsa a 1 (I-286).
        expect(opciones).toEqual({});
        expect(opciones.modeloClasificacion).toBeUndefined();
    });

    it("con override → llama a `clasificarConMotorActivo` con `{modeloClasificacion: X}` (mono-modelo intencional)", async () => {
        await clasificarReporte({
            reporteId: "r2",
            texto: "texto",
            parametros: parametrosBase({ overrideModeloClasificacion: "ornith:9b" }),
            ejemplosRag: [],
        });

        const [, opciones] = mocks.clasificarConMotorActivo.mock.calls[0]!;
        expect(opciones).toEqual({ modeloClasificacion: "ornith:9b" });
    });

    it("`parametros.modeloClasificacion` (uso secundario) NO se cablea al motor por sí solo", async () => {
        // Aunque `modeloClasificacion` esté seteado a algo distinto, sin
        // `overrideModeloClasificacion` el motor no lo ve. Este es el corazón
        // del arreglo: separar "parámetro para otros usos" del "override
        // quirúrgico del comité de votación".
        await clasificarReporte({
            reporteId: "r3",
            texto: "texto",
            parametros: parametrosBase({
                modeloClasificacion: "ornith:9b",
                overrideModeloClasificacion: undefined,
            }),
            ejemplosRag: [],
        });

        const [, opciones] = mocks.clasificarConMotorActivo.mock.calls[0]!;
        expect(opciones.modeloClasificacion).toBeUndefined();
    });

    // ── Persistencia del jurado completo ───────────────────────────────────
    it("cuando el motor devuelve el comité completo, se persiste una fila `ClasificacionRubricaVoto` POR MODELO", async () => {
        await clasificarReporte({
            reporteId: "r4",
            texto: "texto",
            parametros: parametrosBase(),
            ejemplosRag: [],
        });

        expect(mocks.createManyVotos).toHaveBeenCalledTimes(1);
        const filas = mocks.createManyVotos.mock.calls[0]![0]!.data as Array<{ modelo: string }>;
        // El comité en `ia.rubrica.modelos` declara 3 modelos → 3 filas.
        // Si el bug I-286 volviera, este número caería a 1 y el test falla.
        const modelosPersistidos = new Set(filas.map((f) => f.modelo));
        expect(modelosPersistidos.size).toBe(3);
        expect(modelosPersistidos).toEqual(new Set(["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"]));
    });

    // ── Bandera de override (SPEC-398 · reintro CEO 2026-09-03 12:55) ──────
    it("pipeline real (sin override) persiste `overrideModeloUsado: null`", async () => {
        await clasificarReporte({
            reporteId: "r5",
            texto: "texto",
            parametros: parametrosBase(),
            ejemplosRag: [],
        });
        const dataCreate = mocks.create.mock.calls[0]![0]!.data as { overrideModeloUsado: string | null };
        expect(dataCreate.overrideModeloUsado).toBeNull();
    });

    it("A/B intencional (con override) persiste `overrideModeloUsado: <modelo>` — así la alarma no chilla", async () => {
        await clasificarReporte({
            reporteId: "r6",
            texto: "texto",
            parametros: parametrosBase({ overrideModeloClasificacion: "ornith:9b" }),
            ejemplosRag: [],
        });
        const dataCreate = mocks.create.mock.calls[0]![0]!.data as { overrideModeloUsado: string | null };
        expect(dataCreate.overrideModeloUsado).toBe("ornith:9b");
    });
});
