/**
 * SPEC-216 (002-PI-116): tests unitarios de cálculos de pagos.
 */
import { describe, it, expect } from "vitest";
import { TipoBono } from "@prisma/client";
import { calcularDescuentoBono, aplicarMayorDescuento } from "./pagos-calculos.service";

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
