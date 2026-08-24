/**
 * SPEC-226 (002-PI-mega-cola, FR-016/SC-006): tests unitarios de los helpers
 * puros del handler `crear_bono` (sin BD): vigencia en America/Bogota con
 * frontera de día 23:59/00:01 y nombre único trazable.
 */
import { describe, it, expect } from "vitest";
import { calcularVigenciaBono, generarNombreBono } from "./crear-bono";

describe("calcularVigenciaBono (America/Bogota)", () => {
    it("bono creado a las 23:59 Bogotá: inicio 00:00 de hoy, fin 23:59 de hoy+N (Bogotá)", () => {
        // 2026-08-24 23:59 Bogotá (UTC-5, sin DST).
        const ahora = new Date("2026-08-25T04:59:00.000Z");
        const { vigenciaInicio, vigenciaFin } = calcularVigenciaBono(ahora, 15);
        expect(vigenciaInicio.toISOString()).toBe("2026-08-24T05:00:00.000Z"); // 00:00 Bogotá del 24
        expect(vigenciaFin.toISOString()).toBe("2026-09-09T04:59:59.999Z"); // 23:59:59.999 Bogotá del 8 sep
    });

    it("bono creado a las 00:01 Bogotá: la ventana corre al día siguiente", () => {
        // 2026-08-25 00:01 Bogotá.
        const ahora = new Date("2026-08-25T05:01:00.000Z");
        const { vigenciaInicio, vigenciaFin } = calcularVigenciaBono(ahora, 15);
        expect(vigenciaInicio.toISOString()).toBe("2026-08-25T05:00:00.000Z"); // 00:00 Bogotá del 25
        expect(vigenciaFin.toISOString()).toBe("2026-09-10T04:59:59.999Z"); // 23:59:59.999 Bogotá del 9 sep
    });

    it("vigenciaDias = 1: vence al final del día siguiente Bogotá", () => {
        const ahora = new Date("2026-08-24T15:00:00.000Z"); // 10:00 Bogotá
        const { vigenciaInicio, vigenciaFin } = calcularVigenciaBono(ahora, 1);
        expect(vigenciaInicio.toISOString()).toBe("2026-08-24T05:00:00.000Z");
        expect(vigenciaFin.toISOString()).toBe("2026-08-26T04:59:59.999Z"); // 23:59:59.999 Bogotá del 25
    });
});

describe("generarNombreBono", () => {
    it("formato AUT-<reglaClave>-<sujetoCorto>-<yyyyMMdd> con fecha Bogotá", () => {
        const ahora = new Date("2026-08-25T04:59:00.000Z"); // aún 24 en Bogotá
        const nombre = generarNombreBono("vencimiento.T_menos_7", "abcdefghijklmnop", ahora);
        expect(nombre).toBe("AUT-VENCIMIENTO-T-MENOS-7-abcdefgh-20260824");
    });

    it("sanitiza caracteres no alfanuméricos de la clave", () => {
        const nombre = generarNombreBono("mora.t30+", "subscript-1", new Date("2026-08-24T12:00:00.000Z"));
        expect(nombre).toBe("AUT-MORA-T30-subscrip-20260824");
    });
});
