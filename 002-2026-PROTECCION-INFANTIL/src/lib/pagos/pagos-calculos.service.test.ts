/**
 * SPEC-216 (002-PI-116): tests unitarios de cálculos de pagos.
 */
import { describe, it, expect } from "vitest";
import { TipoBono } from "@prisma/client";
import { calcularDescuentoBono, calcularDescuentoBonoCOP, aplicarMayorDescuento } from "./pagos-calculos.service";

describe("calcularDescuentoBono", () => {
    it("calcula descuento por porcentaje", () => {
        const descuento = calcularDescuentoBono(100, { tipo: TipoBono.DESCUENTO_PCT, valor: 20 });
        expect(descuento).toBe(20);
    });

    it("limita el porcentaje al 100%", () => {
        const descuento = calcularDescuentoBono(100, { tipo: TipoBono.DESCUENTO_PCT, valor: 150 });
        expect(descuento).toBe(100);
    });

    it("calcula descuento fijo en USD", () => {
        const descuento = calcularDescuentoBono(100, { tipo: TipoBono.DESCUENTO_FIJO_USD, valor: 30 });
        expect(descuento).toBe(30);
    });

    it("no permite descuento fijo mayor al monto base", () => {
        const descuento = calcularDescuentoBono(50, { tipo: TipoBono.DESCUENTO_FIJO_USD, valor: 80 });
        expect(descuento).toBe(50);
    });

    it("calcula meses gratis como multiplo del monto base", () => {
        const descuento = calcularDescuentoBono(10, { tipo: TipoBono.MESES_GRATIS, valor: 2 });
        expect(descuento).toBe(20);
    });

    it("retorna 0 para monto base no positivo", () => {
        expect(calcularDescuentoBono(0, { tipo: TipoBono.DESCUENTO_PCT, valor: 20 })).toBe(0);
        expect(calcularDescuentoBono(-10, { tipo: TipoBono.DESCUENTO_FIJO_USD, valor: 5 })).toBe(0);
    });

    it("retorna 0 para valor de bono no finito", () => {
        expect(calcularDescuentoBono(100, { tipo: TipoBono.DESCUENTO_PCT, valor: NaN })).toBe(0);
        expect(calcularDescuentoBono(100, { tipo: TipoBono.DESCUENTO_PCT, valor: -5 })).toBe(0);
    });
});

describe("aplicarMayorDescuento", () => {
    it("retorna el mayor descuento", () => {
        expect(aplicarMayorDescuento(10, 25)).toBe(25);
        expect(aplicarMayorDescuento(30, 12)).toBe(30);
    });

    it("nunca retorna negativo", () => {
        expect(aplicarMayorDescuento(-10, -5)).toBe(0);
    });

    it("soporta valores no finitos", () => {
        expect(aplicarMayorDescuento(NaN, 15)).toBe(15);
        expect(aplicarMayorDescuento(10, NaN)).toBe(10);
    });
});

// SPEC-289 (002-PI-189 · Fase 1)
describe("calcularDescuentoBonoCOP", () => {
    it("DESCUENTO_PCT: 20% × 100000 = 20000 (cero tasa)", () => {
        expect(calcularDescuentoBonoCOP(100000, { tipo: TipoBono.DESCUENTO_PCT, valor: 20 })).toBe(20000);
    });

    it("DESCUENTO_PCT: limita al 100%", () => {
        expect(calcularDescuentoBonoCOP(100000, { tipo: TipoBono.DESCUENTO_PCT, valor: 150 })).toBe(100000);
    });

    it("MESES_GRATIS: 2 × 100000 = 200000 pero capado al precio base", () => {
        // El descuento nunca supera el precio base para no dejar cobros negativos.
        expect(calcularDescuentoBonoCOP(100000, { tipo: TipoBono.MESES_GRATIS, valor: 2 })).toBe(100000);
    });

    it("MESES_GRATIS: 0.5 meses × 100000 = 50000 (cero tasa)", () => {
        expect(calcularDescuentoBonoCOP(100000, { tipo: TipoBono.MESES_GRATIS, valor: 0.5 })).toBe(50000);
    });

    it("DESCUENTO_FIJO_USD con tasaFallback=4000: 5 USD × 4000 = 20000 COP", () => {
        expect(calcularDescuentoBonoCOP(100000, { tipo: TipoBono.DESCUENTO_FIJO_USD, valor: 5 }, 4000)).toBe(20000);
    });

    it("DESCUENTO_FIJO_USD sin tasa: fallback 1:1 → 5 (no 503)", () => {
        expect(calcularDescuentoBonoCOP(100000, { tipo: TipoBono.DESCUENTO_FIJO_USD, valor: 5 })).toBe(5);
    });

    it("DESCUENTO_FIJO_USD cap: no supera el precio base", () => {
        expect(calcularDescuentoBonoCOP(100, { tipo: TipoBono.DESCUENTO_FIJO_USD, valor: 500 }, 4000)).toBe(100);
    });

    it("precioBaseCOP inválido → 0", () => {
        expect(calcularDescuentoBonoCOP(0, { tipo: TipoBono.DESCUENTO_PCT, valor: 20 })).toBe(0);
        expect(calcularDescuentoBonoCOP(-100, { tipo: TipoBono.DESCUENTO_PCT, valor: 20 })).toBe(0);
        expect(calcularDescuentoBonoCOP(NaN, { tipo: TipoBono.DESCUENTO_PCT, valor: 20 })).toBe(0);
    });

    it("bono.valor inválido → 0", () => {
        expect(calcularDescuentoBonoCOP(100000, { tipo: TipoBono.DESCUENTO_PCT, valor: -1 })).toBe(0);
        expect(calcularDescuentoBonoCOP(100000, { tipo: TipoBono.DESCUENTO_PCT, valor: NaN })).toBe(0);
    });

    it("resultado siempre no-negativo y entero COP", () => {
        const r = calcularDescuentoBonoCOP(100000, { tipo: TipoBono.DESCUENTO_PCT, valor: 33 });
        expect(r).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(r)).toBe(true);
    });
});
