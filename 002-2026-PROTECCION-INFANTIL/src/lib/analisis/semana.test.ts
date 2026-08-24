/**
 * SPEC-223 (002-PI-124): tests de frontera de la ventana semanal Bogotá y del
 * periodo ISO — puros, sin BD (registrado en vitest.unit.includes.ts).
 */
import { describe, expect, it } from "vitest";
import { periodoSemanaISOBogota, ventanaSemanaAnteriorBogota } from "./semana";

// America/Bogota = UTC-5: lunes 00:00 Bogotá ≡ 05:00 UTC del mismo día.
const bogota = (iso: string) => new Date(`${iso}:00-05:00`);

describe("ventanaSemanaAnteriorBogota", () => {
    it("lunes 08:00 Bogotá → ventana de la semana anterior completa [lunes, lunes)", () => {
        const v = ventanaSemanaAnteriorBogota(bogota("2026-08-24T08:00"));
        expect(v.desde.toISOString()).toBe("2026-08-17T05:00:00.000Z");
        expect(v.hasta.toISOString()).toBe("2026-08-24T05:00:00.000Z");
        expect(v.periodo).toBe("2026-W34");
    });

    it("frontera: domingo 23:59 Bogotá mide la semana que ya cerró; lunes 00:01 mide la que cerró el lunes", () => {
        // Domingo 23:59 Bogotá: la semana "anterior" es la del 10-16 ago.
        const domingo = ventanaSemanaAnteriorBogota(bogota("2026-08-23T23:59"));
        expect(domingo.desde.toISOString()).toBe("2026-08-10T05:00:00.000Z");
        expect(domingo.hasta.toISOString()).toBe("2026-08-17T05:00:00.000Z");
        // Lunes 00:01 Bogotá: ya cerró la semana 17-23 ago.
        const lunes = ventanaSemanaAnteriorBogota(bogota("2026-08-24T00:01"));
        expect(lunes.desde.toISOString()).toBe("2026-08-17T05:00:00.000Z");
        expect(lunes.hasta.toISOString()).toBe("2026-08-24T05:00:00.000Z");
    });

    it("un dato del domingo 23:59 Bogotá cae dentro de la ventana; uno del lunes 00:01 queda fuera", () => {
        const v = ventanaSemanaAnteriorBogota(bogota("2026-08-24T08:00"));
        const domingo2359 = bogota("2026-08-23T23:59");
        const lunes0001 = bogota("2026-08-24T00:01");
        expect(domingo2359 >= v.desde && domingo2359 < v.hasta).toBe(true);
        expect(lunes0001 >= v.desde && lunes0001 < v.hasta).toBe(false);
    });

    it("frontera de año ISO: la corrida del primer lunes de 2027 mide 2026-W53", () => {
        const v = ventanaSemanaAnteriorBogota(bogota("2027-01-04T08:00"));
        expect(v.desde.toISOString()).toBe("2026-12-28T05:00:00.000Z");
        expect(v.hasta.toISOString()).toBe("2027-01-04T05:00:00.000Z");
        expect(v.periodo).toBe("2026-W53");
    });

    it("frontera de año ISO: el último lunes de 2025 mide 2025-W52", () => {
        const v = ventanaSemanaAnteriorBogota(bogota("2025-12-29T08:00"));
        expect(v.desde.toISOString()).toBe("2025-12-22T05:00:00.000Z");
        expect(v.periodo).toBe("2025-W52");
    });
});

describe("periodoSemanaISOBogota", () => {
    it("el 29-dic-2025 Bogotá es la semana ISO W01 de 2026", () => {
        expect(periodoSemanaISOBogota(bogota("2025-12-29T12:00"))).toBe("2026-W01");
    });

    it("el 1-ene-2027 Bogotá sigue siendo 2026-W53 (año ISO, no calendario)", () => {
        expect(periodoSemanaISOBogota(bogota("2027-01-01T00:30"))).toBe("2026-W53");
    });

    it("usa el reloj Bogotá, no UTC: domingo 20:00 Bogotá ya es lunes 01:00 UTC", () => {
        // 2026-08-23 20:00 Bogotá = 2026-08-24 01:00 UTC. En Bogotá aún es la
        // semana del 17 ago (W34); en UTC sería la semana del 24 (W35).
        expect(periodoSemanaISOBogota(bogota("2026-08-23T20:00"))).toBe("2026-W34");
    });
});
