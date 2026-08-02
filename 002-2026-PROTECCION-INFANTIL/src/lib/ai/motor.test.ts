/**
 * SPEC-138 (E-7): selector unificado del motor (src/lib/ai/motor.ts).
 * El switch `ia.rubrica.enabled` (parámetro real en BD) decide la rama:
 * - false (default seguro) → motor legacy (clasificarConVotos), overrides aplicados.
 * - true → motor rúbrica (clasificarConRubrica), resultado completo propagado.
 * Los motores se mockean por módulo (el test prueba la SELECCIÓN, no el motor).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import type { ClassificationResult } from "./classifier";
import type { ResultadoRubrica } from "./rubrica";

const mockConVotos = vi.fn();
const mockConRubrica = vi.fn();

vi.mock("./classifier", () => ({
    clasificarConVotos: (...args: unknown[]) => mockConVotos(...args),
}));

vi.mock("./rubrica", async (importOriginal) => {
    const original = await importOriginal<typeof import("./rubrica")>();
    return {
        ...original, // cargarConfigRubrica REAL: lee ia.rubrica.enabled de la BD de test
        clasificarConRubrica: (...args: unknown[]) => mockConRubrica(...args),
    };
});

import { clasificarConMotorActivo, motorActivo, leerPosibleAgresorPar } from "./motor";

function resultadoLegacy(): ClassificationResult {
    return {
        categoria: "CONTACTO_INSISTENTE",
        confianza: 0.9,
        categoriasSecundarias: [],
        posibleAgresorPar: true,
        estado: "CLASIFICADO",
        rawResponse: "raw",
        metrics: { modelo: "ornith:9b", latenciaMs: 100, promptTokens: null, responseTokens: null, totalDuration: null, loadDuration: null },
        fallback: false,
        votos: [],
    };
}

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

async function sembrarFlag(valor: string) {
    await prisma.parametroSistema.create({
        data: { clave: "ia.rubrica.enabled", valor, tipo: "BOOLEAN", categoria: "SECURITY", esPublico: false },
    });
}

describe("SPEC-138 · selector unificado del motor", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockConVotos.mockReset().mockResolvedValue(resultadoLegacy());
        mockConRubrica.mockReset().mockResolvedValue(resultadoRubrica());
    });

    it("flag off (default seguro): invoca el motor legacy y aplica los overrides de votación", async () => {
        await sembrarFlag("false");

        const resultado = await clasificarConMotorActivo("texto de prueba", {
            modeloClasificacionLegacy: "modelo-x:7b",
            voting: { nVotos: 3 },
        });

        expect(resultado.motor).toBe("legacy");
        expect(mockConVotos).toHaveBeenCalledTimes(1);
        expect(mockConVotos.mock.calls[0][0]).toBe("modelo-x:7b");
        expect(mockConVotos.mock.calls[0][2]).toMatchObject({ nVotos: 3 });
        expect(mockConRubrica, "la rúbrica no se invoca con el flag off").not.toHaveBeenCalled();
        // El legacy SÍ produce posibleAgresorPar: se propaga el valor real.
        expect(resultado.posibleAgresorPar).toBe(true);
        expect(resultado.rubrica).toBeUndefined();
    });

    it("flag on: invoca la rúbrica (nunca el legacy) y propaga el resultado completo", async () => {
        await sembrarFlag("true");

        const resultado = await clasificarConMotorActivo("texto de prueba");

        expect(resultado.motor).toBe("rubrica");
        expect(mockConRubrica).toHaveBeenCalledTimes(1);
        expect(mockConVotos, "el legacy no se invoca con el flag on").not.toHaveBeenCalled();
        expect(resultado.categoria).toBe("EXTORSION");
        expect(resultado.metrics.promptTokens).toBe(10);
        expect(resultado.rubrica).toBeDefined();
        expect(resultado.votos).toEqual([]);
    });

    it("motorActivo lee el flag sin ejecutar el motor", async () => {
        await sembrarFlag("false");
        expect(await motorActivo()).toBe("legacy");

        await prisma.parametroSistema.update({ where: { clave: "ia.rubrica.enabled" }, data: { valor: "true" } });
        expect(await motorActivo()).toBe("rubrica");

        expect(mockConVotos, "motorActivo no ejecuta ningún motor").not.toHaveBeenCalled();
        expect(mockConRubrica).not.toHaveBeenCalled();
    });

    it("sin el parámetro en BD, el default seguro es legacy", async () => {
        const resultado = await clasificarConMotorActivo("texto");
        expect(resultado.motor).toBe("legacy");
    });

    it("leerPosibleAgresorPar: tolerante ante la ausencia del campo (NEEDS CLARIFICATION)", () => {
        expect(leerPosibleAgresorPar(undefined)).toBe(false);
        expect(leerPosibleAgresorPar(resultadoRubrica())).toBe(false);
        expect(
            leerPosibleAgresorPar({ ...resultadoRubrica(), posibleAgresorPar: true } as ResultadoRubrica & { posibleAgresorPar: boolean })
        ).toBe(true);
    });
});
