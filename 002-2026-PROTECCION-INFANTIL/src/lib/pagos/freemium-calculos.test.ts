/**
 * SPEC-217 (002-PI-117): tests unitarios de los cálculos puros del freemium
 * (sin BD). Fechas fijas en America/Bogota (UTC-5, sin DST).
 */
import { describe, it, expect } from "vitest";
import { DuracionPlan } from "@prisma/client";
import {
    MESES_POR_DURACION,
    calcularDiasRestantesFreemium,
    calcularFechaFinTrasPagoFreemium,
    calcularFreemiumFechaFin,
    mesesDeDuracion,
} from "./freemium-calculos";

describe("mesesDeDuracion", () => {
    it("mapea cada duración a sus meses", () => {
        expect(MESES_POR_DURACION).toEqual({ MES_1: 1, MES_2: 2, MES_3: 3, MES_6: 6, MES_12: 12 });
        expect(mesesDeDuracion(DuracionPlan.MES_1)).toBe(1);
        expect(mesesDeDuracion(DuracionPlan.MES_12)).toBe(12);
    });
});

describe("calcularFreemiumFechaFin", () => {
    it("suma los días en calendario Bogotá y corta al final del día (AS-001)", () => {
        // Inicio: medianoche Bogotá del 2026-08-23 (05:00 UTC).
        const inicio = new Date("2026-08-23T05:00:00.000Z");
        const fin = calcularFreemiumFechaFin(inicio, 30);
        // Fin del día Bogotá del 2026-09-22: 23:59:59.999 -05:00 = 2026-09-23T04:59:59.999Z.
        expect(fin.toISOString()).toBe("2026-09-23T04:59:59.999Z");
    });

    it("un inicio a media tarde Bogotá corta igual al final del día de corte", () => {
        // 2026-08-23 15:00 Bogotá (20:00 UTC) + 30 días → fin del 2026-09-22 Bogotá.
        const inicio = new Date("2026-08-23T20:00:00.000Z");
        const fin = calcularFreemiumFechaFin(inicio, 30);
        expect(fin.toISOString()).toBe("2026-09-23T04:59:59.999Z");
    });

    it("duración inválida se trata como 0 días (fin del mismo día de inicio)", () => {
        const inicio = new Date("2026-08-23T05:00:00.000Z");
        expect(calcularFreemiumFechaFin(inicio, 0).toISOString()).toBe("2026-08-24T04:59:59.999Z");
        expect(calcularFreemiumFechaFin(inicio, Number.NaN).toISOString()).toBe("2026-08-24T04:59:59.999Z");
    });
});

describe("calcularFechaFinTrasPagoFreemium", () => {
    it("con freemium vigente extiende desde freemiumFechaFin (AS-004)", () => {
        const freemiumFechaFin = new Date("2026-09-23T04:59:59.999Z");
        const ahora = new Date("2026-09-01T15:00:00.000Z");
        const fin = calcularFechaFinTrasPagoFreemium({ freemiumFechaFin, ahora, duracionCubierta: DuracionPlan.MES_1 });
        expect(fin.toISOString()).toBe("2026-10-23T04:59:59.999Z");
    });

    it("con freemium vencido extiende desde la fecha de autorización (Decisión 2)", () => {
        const freemiumFechaFin = new Date("2026-08-01T04:59:59.999Z");
        const ahora = new Date("2026-08-24T15:00:00.000Z");
        const fin = calcularFechaFinTrasPagoFreemium({ freemiumFechaFin, ahora, duracionCubierta: DuracionPlan.MES_12 });
        expect(fin.toISOString()).toBe("2027-08-24T15:00:00.000Z");
    });
});

describe("calcularDiasRestantesFreemium", () => {
    const ahora = new Date("2026-08-24T15:00:00.000Z"); // 2026-08-24 en pared Bogotá

    it("devuelve null cuando no es freemium o no hay fecha de fin", () => {
        expect(calcularDiasRestantesFreemium(false, new Date("2026-09-01T05:00:00.000Z"), ahora)).toBeNull();
        expect(calcularDiasRestantesFreemium(true, null, ahora)).toBeNull();
    });

    it("cuenta días calendario Bogotá hasta el fin del freemium", () => {
        // Fin del día Bogotá 2026-08-30 → 6 días desde el 24.
        const fin = new Date("2026-08-31T04:59:59.999Z");
        expect(calcularDiasRestantesFreemium(true, fin, ahora)).toBe(6);
    });

    it("nunca devuelve negativo (freemium vencido = 0)", () => {
        const fin = new Date("2026-08-20T04:59:59.999Z");
        expect(calcularDiasRestantesFreemium(true, fin, ahora)).toBe(0);
    });
});
