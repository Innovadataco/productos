/**
 * CANDADO · SPEC-751 — la puerta de audiencia del menor es per-menor, sensible a la versión
 * según la política, y NO debilita la puerta de cuenta (regresión de SPEC-241). Unit puro.
 */
import { describe, it, expect } from "vitest";
import {
    menorEstaAlDia,
    menoresPendientesDeAudiencia,
    titularAlDia,
    type MenorActivoAudiencia,
} from "./audiencia-gate";

const V = "2026-09-v3";
const V_VIEJA = "2026-08-v2";

describe("SPEC-751 · menorEstaAlDia — según la política de re-oír", () => {
    it("nunca oído → NO al día (en cualquier política)", () => {
        expect(menorEstaAlDia([], V, true)).toBe(false);
        expect(menorEstaAlDia([], V, false)).toBe(false);
    });
    it("re-oír=true: oído solo con versión VIEJA → NO al día (hay que re-oír en el bump)", () => {
        expect(menorEstaAlDia([V_VIEJA], V, true)).toBe(false);
    });
    it("re-oír=true: oído con la versión VIGENTE → al día", () => {
        expect(menorEstaAlDia([V_VIEJA, V], V, true)).toBe(true);
    });
    it("re-oír=false: oído aunque sea con versión VIEJA → al día (una audiencia basta)", () => {
        expect(menorEstaAlDia([V_VIEJA], V, false)).toBe(true);
    });
});

describe("SPEC-751 · C-per-menor-no-global — oír a uno NO cubre a los demás", () => {
    const unoAlDiaUnoNo: MenorActivoAudiencia[] = [
        { hijoId: "h-oido", versionesAudiencia: [V] },
        { hijoId: "h-pendiente", versionesAudiencia: [] },
    ];

    it("con uno oído y uno no, el pendiente sigue faltando (solo ese)", () => {
        expect(menoresPendientesDeAudiencia(unoAlDiaUnoNo, V, true)).toEqual(["h-pendiente"]);
    });

    it("control positivo (remover el discriminador): si AMBOS están oídos, no falta ninguno", () => {
        const ambos: MenorActivoAudiencia[] = [
            { hijoId: "h-oido", versionesAudiencia: [V] },
            { hijoId: "h-pendiente", versionesAudiencia: [V] },
        ];
        expect(menoresPendientesDeAudiencia(ambos, V, true)).toEqual([]);
    });
});

describe("SPEC-751 · C-no-romper-cuenta — el eje de cuenta (241) manda y no se debilita", () => {
    const menorAlDia: MenorActivoAudiencia[] = [{ hijoId: "h1", versionesAudiencia: [V] }];
    const menorPendiente: MenorActivoAudiencia[] = [{ hijoId: "h1", versionesAudiencia: [] }];

    it("cuenta NO vigente → NO al día, aunque no haya menores (igual que 241)", () => {
        expect(titularAlDia(false, [], V, true)).toBe(false);
    });
    it("cuenta NO vigente → NO al día, aunque los menores estén oídos (la cuenta manda)", () => {
        expect(titularAlDia(false, menorAlDia, V, true)).toBe(false);
    });
    it("cuenta vigente + SIN menores → al día (idéntico al comportamiento de 241)", () => {
        expect(titularAlDia(true, [], V, true)).toBe(true);
    });
    it("cuenta vigente + un menor pendiente → NO al día (dimensión nueva)", () => {
        expect(titularAlDia(true, menorPendiente, V, true)).toBe(false);
    });
    it("cuenta vigente + todos los menores oídos → al día", () => {
        expect(titularAlDia(true, menorAlDia, V, true)).toBe(true);
    });
});
