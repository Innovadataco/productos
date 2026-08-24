/**
 * SPEC-227 (002-PI-128): tests unitarios de los filtros compartidos del
 * historial (FR-002): parse Zod, 400 en inválidos y frontera de día calendario
 * America/Bogota (edge case: el día "hasta" incluye sus 23:59:59.999).
 */
import { describe, it, expect } from "vitest";
import {
    filtrosHistorialSchema,
    parsearFiltrosDesdeSearchParams,
    resolverFiltros,
    inicioDiaBogotaUtc,
    finDiaBogotaUtc,
} from "./filtros-historial";

describe("filtrosHistorialSchema", () => {
    it("acepta un objeto vacío (sin filtros)", () => {
        expect(filtrosHistorialSchema.parse({})).toEqual({});
    });

    it("acepta todos los filtros válidos", () => {
        const parseado = filtrosHistorialSchema.parse({
            estado: "IGNORADA",
            reglaId: "regla-1",
            categoria: "renovacion",
            sujetoTipo: "Suscripcion",
            sujetoId: "suj-1",
            ejecutadaAutomatica: "true",
            desde: "2026-08-01",
            hasta: "2026-08-31",
        });
        expect(parseado.estado).toBe("IGNORADA");
        expect(parseado.ejecutadaAutomatica).toBe("true");
    });

    it("rechaza un estado fuera del enum", () => {
        expect(() => filtrosHistorialSchema.parse({ estado: "BORRADA" })).toThrow();
    });

    it("rechaza un sujetoTipo fuera del enum", () => {
        expect(() => filtrosHistorialSchema.parse({ sujetoTipo: "Cliente" })).toThrow();
    });

    it("rechaza ejecutadaAutomatica que no sea true/false", () => {
        expect(() => filtrosHistorialSchema.parse({ ejecutadaAutomatica: "si" })).toThrow();
    });

    it("rechaza fechas con formato inválido o día inexistente", () => {
        expect(() => filtrosHistorialSchema.parse({ desde: "24/08/2026" })).toThrow();
        expect(() => filtrosHistorialSchema.parse({ desde: "2026-02-30" })).toThrow();
    });

    it("rechaza rango con desde posterior a hasta", () => {
        expect(() =>
            filtrosHistorialSchema.parse({ desde: "2026-08-31", hasta: "2026-08-01" })
        ).toThrow();
    });
});

describe("frontera de día calendario America/Bogota", () => {
    it("desde → 00:00:00.000 Bogotá (UTC-5)", () => {
        expect(inicioDiaBogotaUtc("2026-08-24").toISOString()).toBe("2026-08-24T05:00:00.000Z");
    });

    it("hasta → 23:59:59.999 Bogotá (la frontera del día queda incluida)", () => {
        expect(finDiaBogotaUtc("2026-08-24").toISOString()).toBe("2026-08-25T04:59:59.999Z");
    });
});

describe("resolverFiltros", () => {
    it("convierte ejecutadaAutomatica y el rango a UTC", () => {
        const resuelto = resolverFiltros(
            filtrosHistorialSchema.parse({
                ejecutadaAutomatica: "false",
                desde: "2026-08-01",
                hasta: "2026-08-31",
            })
        );
        expect(resuelto.ejecutadaAutomatica).toBe(false);
        expect(resuelto.generadaDesdeUtc?.toISOString()).toBe("2026-08-01T05:00:00.000Z");
        expect(resuelto.generadaHastaUtc?.toISOString()).toBe("2026-09-01T04:59:59.999Z");
    });

    it("deja undefined los filtros ausentes", () => {
        const resuelto = resolverFiltros({});
        expect(resuelto.estado).toBeUndefined();
        expect(resuelto.generadaDesdeUtc).toBeUndefined();
        expect(resuelto.ejecutadaAutomatica).toBeUndefined();
    });
});

describe("parsearFiltrosDesdeSearchParams", () => {
    it("ignora parámetros ausentes o vacíos", () => {
        const params = new URLSearchParams("estado=APLICADA&reglaId=&desde=");
        const parseado = parsearFiltrosDesdeSearchParams(params);
        expect(parseado).toEqual({ estado: "APLICADA" });
    });

    it("lanza (ZodError → 400) con un filtro inválido", () => {
        const params = new URLSearchParams("estado=CUALQUIERA");
        expect(() => parsearFiltrosDesdeSearchParams(params)).toThrow();
    });
});
