/**
 * SPEC-138 (E-7): selector unificado del motor (src/lib/ai/motor.ts).
 * A partir de la Fase 3 de 002-PI-068 el único motor activo es la RÚBRICA.
 * Este test prueba que `clasificarConMotorActivo` delega siempre en
 * `clasificarConRubrica` y adapta el resultado a `ResultadoMotor`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import type { ResultadoRubrica } from "./rubrica";

const mockConRubrica = vi.fn();

vi.mock("./rubrica", async (importOriginal) => {
    const original = await importOriginal<typeof import("./rubrica")>();
    return {
        ...original,
        clasificarConRubrica: (...args: unknown[]) => mockConRubrica(...args),
    };
});

import { clasificarConMotorActivo, leerPosibleAgresorPar } from "./motor";

function resultadoRubrica(): ResultadoRubrica {
    return {
        categoria: "EXTORSION",
        confianza: 1,
        categoriasPresentes: ["EXTORSION"],
        categoriasSecundarias: [],
        porcentajes: { EXTORSION: 1 },
        estado: "CLASIFICADO",
        votosModelos: [],
        metrics: { modelo: "rubrica:a+b", latenciaMs: 200, promptTokens: 10, responseTokens: 20 },
        rawResponse: "raw-rubrica",
        fallback: false,
    };
}

describe("SPEC-138 · selector unificado del motor (solo rúbrica)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockConRubrica.mockReset().mockResolvedValue(resultadoRubrica());
    });

    it("llama siempre a la rúbrica y propaga el resultado completo", async () => {
        const resultado = await clasificarConMotorActivo("texto de prueba");

        expect(mockConRubrica).toHaveBeenCalledTimes(1);
        expect(resultado.categoria).toBe("EXTORSION");
        expect(resultado.metrics.promptTokens).toBe(10);
        expect(resultado.rubrica).toBeDefined();
        expect(resultado.votos).toEqual([]);
    });

    it("pasa configRubrica al motor", async () => {
        await clasificarConMotorActivo("texto", {
            configRubrica: { modelos: ["m1"], temperatura: 0.5, umbralPresencia: 0.8 },
        });

        expect(mockConRubrica).toHaveBeenCalledWith("texto", {
            modelos: ["m1"],
            temperatura: 0.5,
            umbralPresencia: 0.8,
        });
    });

    it("sin parámetros en BD sigue usando la rúbrica (default del motor)", async () => {
        const resultado = await clasificarConMotorActivo("texto");
        expect(mockConRubrica).toHaveBeenCalledTimes(1);
        expect(resultado.categoria).toBe("EXTORSION");
    });

    it("leerPosibleAgresorPar: tolerante ante la ausencia del campo", () => {
        expect(leerPosibleAgresorPar(undefined)).toBe(false);
        expect(leerPosibleAgresorPar(resultadoRubrica())).toBe(false);
        expect(
            leerPosibleAgresorPar({ ...resultadoRubrica(), posibleAgresorPar: true } as ResultadoRubrica & { posibleAgresorPar: boolean })
        ).toBe(true);
    });
});
