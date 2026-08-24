/**
 * SPEC-211 (002-PI-111): tests unitarios de los cálculos puros de renovación.
 */
import { describe, it, expect } from "vitest";
import {
    anioBogota,
    calcularDescuentoAnualUSD,
    calcularDiasRestantesBogota,
    resolverDescuentoTotal,
} from "./renovacion-calculos";

describe("calcularDescuentoAnualUSD", () => {
    it("calcula el porcentaje sobre el monto base", () => {
        expect(calcularDescuentoAnualUSD(100, 15)).toBe(15);
    });

    it("devuelve 0 con montos o porcentajes inválidos", () => {
        expect(calcularDescuentoAnualUSD(0, 15)).toBe(0);
        expect(calcularDescuentoAnualUSD(-5, 15)).toBe(0);
        expect(calcularDescuentoAnualUSD(100, 0)).toBe(0);
        expect(calcularDescuentoAnualUSD(100, Number.NaN)).toBe(0);
    });

    it("topea el porcentaje en 100", () => {
        expect(calcularDescuentoAnualUSD(100, 150)).toBe(100);
    });
});

describe("resolverDescuentoTotal", () => {
    it("suma bonos y referido cuando todos los bonos son combinables", () => {
        const r = resolverDescuentoTotal({
            baseUSD: 100,
            descuentoBonosUSD: 10,
            descuentoReferidoUSD: 5,
            todosBonosCombinables: true,
        });
        expect(r.descuentoTotalUSD).toBe(15);
        expect(r.montoNetoUSD).toBe(85);
    });

    it("aplica el mayor (no la suma) cuando algún bono no es combinable", () => {
        const r = resolverDescuentoTotal({
            baseUSD: 100,
            descuentoBonosUSD: 20,
            descuentoReferidoUSD: 12,
            todosBonosCombinables: false,
        });
        expect(r.descuentoTotalUSD).toBe(20);
        expect(r.montoNetoUSD).toBe(80);
    });

    it("nunca descuenta más que la base ni devuelve neto negativo", () => {
        const r = resolverDescuentoTotal({
            baseUSD: 50,
            descuentoBonosUSD: 60,
            descuentoReferidoUSD: 30,
            todosBonosCombinables: true,
        });
        expect(r.descuentoTotalUSD).toBe(50);
        expect(r.montoNetoUSD).toBe(0);
    });

    it("tolera valores no finitos tratándolos como 0", () => {
        const r = resolverDescuentoTotal({
            baseUSD: 80,
            descuentoBonosUSD: Number.NaN,
            descuentoReferidoUSD: Number.POSITIVE_INFINITY,
            todosBonosCombinables: true,
        });
        expect(r.montoNetoUSD).toBe(80);
    });
});

describe("calcularDiasRestantesBogota", () => {
    it("cuenta días calendario Bogotá entre hoy y el corte", () => {
        const ahora = new Date("2026-08-20T12:00:00Z");
        const fin = new Date("2026-08-25T01:00:00Z");
        expect(calcularDiasRestantesBogota(fin, ahora)).toBe(4);
    });

    it("devuelve 0 cuando vence el mismo día calendario Bogotá", () => {
        const ahora = new Date("2026-08-20T12:00:00Z");
        const finMismoDia = new Date("2026-08-21T02:00:00Z"); // 20 ago 21:00 Bogotá
        expect(calcularDiasRestantesBogota(finMismoDia, ahora)).toBe(0);
    });

    it("devuelve negativo si ya venció", () => {
        const ahora = new Date("2026-08-20T12:00:00Z");
        const fin = new Date("2026-08-18T12:00:00Z");
        expect(calcularDiasRestantesBogota(fin, ahora)).toBe(-2);
    });
});

describe("anioBogota", () => {
    it("usa el año calendario Bogotá, no UTC", () => {
        // 2026-01-01 02:00 UTC = 2025-12-31 21:00 Bogotá
        expect(anioBogota(new Date("2026-01-01T02:00:00Z"))).toBe(2025);
        expect(anioBogota(new Date("2026-01-01T06:00:00Z"))).toBe(2026);
    });
});
