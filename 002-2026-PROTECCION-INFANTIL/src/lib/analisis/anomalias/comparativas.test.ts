/**
 * SPEC-225 (002-PI-126): tests unitarios de la comparativa semanal pura
 * (base mínima, división por cero, umbrales exactos y ambas direcciones).
 */
import { describe, it, expect } from "vitest";
import { evaluarComparativaSemanal } from "./comparativas";

describe("evaluarComparativaSemanal", () => {
    it("base cero: no evaluable, sin división por cero", () => {
        const r = evaluarComparativaSemanal(10, 0, 25, 3, "CRECIMIENTO");
        expect(r.evaluable).toBe(false);
        expect(r.variacionPct).toBeNull();
        expect(r.dispara).toBe(false);
        expect(r.motivoOmision).toBe("base_insuficiente");
    });

    it("base por debajo del mínimo parametrizable: no evaluable", () => {
        const r = evaluarComparativaSemanal(9, 2, 25, 3, "CRECIMIENTO");
        expect(r.evaluable).toBe(false);
        expect(r.motivoOmision).toBe("base_insuficiente");
    });

    it("crecimiento: dispara al superar el umbral y reporta la variación", () => {
        const r = evaluarComparativaSemanal(4, 3, 25, 3, "CRECIMIENTO");
        expect(r.evaluable).toBe(true);
        expect(r.variacionPct).toBe(33.33);
        expect(r.dispara).toBe(true);
    });

    it("crecimiento: variación exactamente igual al umbral NO dispara (estricto)", () => {
        const r = evaluarComparativaSemanal(5, 4, 25, 3, "CRECIMIENTO");
        expect(r.variacionPct).toBe(25);
        expect(r.dispara).toBe(false);
    });

    it("caída: dispara al caer más allá del umbral negativo", () => {
        const r = evaluarComparativaSemanal(6, 10, 30, 3, "CAIDA");
        expect(r.variacionPct).toBe(-40);
        expect(r.dispara).toBe(true);
    });

    it("caída: variación exactamente en -umbral NO dispara (estricto)", () => {
        const r = evaluarComparativaSemanal(7, 10, 30, 3, "CAIDA");
        expect(r.variacionPct).toBe(-30);
        expect(r.dispara).toBe(false);
    });

    it("caída: crecimiento nunca dispara una regla de caída", () => {
        const r = evaluarComparativaSemanal(20, 10, 30, 3, "CAIDA");
        expect(r.variacionPct).toBe(100);
        expect(r.dispara).toBe(false);
    });
});
