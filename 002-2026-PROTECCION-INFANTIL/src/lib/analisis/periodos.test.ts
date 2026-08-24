/**
 * SPEC-220 (002-PI-121): tests unitarios de los helpers de período Bogotá.
 */
import { describe, it, expect } from "vitest";
import {
    esPeriodoValido,
    periodoActualBogota,
    rangoMesBogota,
    periodoLimiteRetencion,
} from "./periodos";

describe("esPeriodoValido", () => {
    it("acepta YYYY-MM con mes 01-12", () => {
        expect(esPeriodoValido("2026-01")).toBe(true);
        expect(esPeriodoValido("2026-12")).toBe(true);
    });

    it("rechaza formatos inválidos", () => {
        expect(esPeriodoValido("2026-13")).toBe(false);
        expect(esPeriodoValido("2026-00")).toBe(false);
        expect(esPeriodoValido("26-08")).toBe(false);
        expect(esPeriodoValido("2026-8")).toBe(false);
        expect(esPeriodoValido("")).toBe(false);
    });
});

describe("periodoActualBogota", () => {
    it("usa el día calendario Bogotá, no UTC (frontera 23:59 último día del mes)", () => {
        // 2026-09-01 04:30 UTC = 2026-08-31 23:30 Bogotá (UTC-5)
        const ahora = new Date("2026-09-01T04:30:00.000Z");
        expect(periodoActualBogota(ahora)).toBe("2026-08");
    });

    it("cambia de período a las 00:00 Bogotá (05:00 UTC)", () => {
        // 2026-09-01 05:30 UTC = 2026-09-01 00:30 Bogotá
        const ahora = new Date("2026-09-01T05:30:00.000Z");
        expect(periodoActualBogota(ahora)).toBe("2026-09");
    });
});

describe("rangoMesBogota", () => {
    it("devuelve [día 1 00:00 Bogotá, día 1 del mes siguiente 00:00 Bogotá) en UTC", () => {
        const { desde, hasta } = rangoMesBogota("2026-08");
        // Bogotá es UTC-5 sin DST: 00:00 Bogotá = 05:00 UTC
        expect(desde.toISOString()).toBe("2026-08-01T05:00:00.000Z");
        expect(hasta.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    });

    it("cruza el año en diciembre", () => {
        const { desde, hasta } = rangoMesBogota("2026-12");
        expect(desde.toISOString()).toBe("2026-12-01T05:00:00.000Z");
        expect(hasta.toISOString()).toBe("2027-01-01T05:00:00.000Z");
    });

    it("lanza error con período inválido", () => {
        expect(() => rangoMesBogota("2026-13")).toThrow();
    });
});

describe("periodoLimiteRetencion", () => {
    it("resta N meses al mes actual Bogotá", () => {
        // 2026-08-15 15:00 UTC = 2026-08-15 10:00 Bogotá
        const ahora = new Date("2026-08-15T15:00:00.000Z");
        expect(periodoLimiteRetencion(24, ahora)).toBe("2024-08");
        expect(periodoLimiteRetencion(12, ahora)).toBe("2025-08");
        expect(periodoLimiteRetencion(1, ahora)).toBe("2026-07");
    });

    it("cruza el año al restar", () => {
        // 2026-01-20 15:00 UTC = 2026-01-20 10:00 Bogotá
        const ahora = new Date("2026-01-20T15:00:00.000Z");
        expect(periodoLimiteRetencion(3, ahora)).toBe("2025-10");
        expect(periodoLimiteRetencion(24, ahora)).toBe("2024-01");
    });
});
