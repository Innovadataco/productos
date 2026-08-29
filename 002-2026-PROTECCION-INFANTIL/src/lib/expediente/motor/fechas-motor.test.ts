/**
 * SPEC-236 (002-PI-mega-cola): tests unitarios de los helpers puros de fechas
 * del motor (America/Bogota), incluyendo la frontera 23:59/00:01 (US2.4).
 */
import { describe, it, expect } from "vitest";
import {
    TIMEZONE_MOTOR_EXPEDIENTE,
    calcularLimiteInactividad,
    cumplioInactividad,
    decidirSlaHoras,
    calcularFechaLimiteSla,
    slaVencido,
    calcularLimiteRetencion,
} from "./fechas-motor";

describe("fechas-motor (SPEC-236)", () => {
    it("usa America/Bogota como zona horaria del motor", () => {
        expect(TIMEZONE_MOTOR_EXPEDIENTE).toBe("America/Bogota");
    });

    it("calcularLimiteInactividad resta meses calendario en Bogotá", () => {
        // 2026-08-24 12:00 UTC = 2026-08-24 07:00 Bogotá.
        const ahora = new Date("2026-08-24T12:00:00.000Z");
        const limite = calcularLimiteInactividad(ahora, 6);
        // 6 meses antes: 2026-02-24 07:00 Bogotá = 2026-02-24 12:00 UTC.
        expect(limite.toISOString()).toBe("2026-02-24T12:00:00.000Z");
    });

    it("cumplioInactividad distingue la frontera 23:59/00:01 en Bogotá", () => {
        // Ahora: 2026-08-24 00:01 Bogotá = 2026-08-24 05:01 UTC.
        const ahora = new Date("2026-08-24T05:01:00.000Z");
        // Límite con 6 meses: 2026-02-24 00:01 Bogotá = 2026-02-24 05:01 UTC.
        // Actividad a las 23:59 Bogotá del día anterior al límite (2026-02-23 23:59 -05:00)
        // = 2026-02-24T04:59Z → anterior al límite → inactivo.
        const actividad2359 = new Date("2026-02-24T04:59:00.000Z");
        expect(cumplioInactividad(actividad2359, 6, ahora)).toBe(true);
        // Actividad a las 00:01 Bogotá del día del límite = 2026-02-24T05:01Z → NO anterior.
        const actividad0001 = new Date("2026-02-24T05:01:00.000Z");
        expect(cumplioInactividad(actividad0001, 6, ahora)).toBe(false);
    });

    it("decidirSlaHoras aplica 12h solo a ROJO", () => {
        expect(decidirSlaHoras("ROJO", 48, 12)).toBe(12);
        expect(decidirSlaHoras("AMARILLO", 48, 12)).toBe(48);
        expect(decidirSlaHoras("VERDE", 48, 12)).toBe(48);
    });

    it("calcularFechaLimiteSla suma horas exactas", () => {
        const desde = new Date("2026-08-20T10:00:00.000Z");
        expect(calcularFechaLimiteSla(desde, 48).toISOString()).toBe("2026-08-22T10:00:00.000Z");
        expect(calcularFechaLimiteSla(desde, 12).toISOString()).toBe("2026-08-20T22:00:00.000Z");
    });

    it("slaVencido respeta el instante exacto del vencimiento", () => {
        const desde = new Date("2026-08-20T10:00:00.000Z");
        expect(slaVencido(new Date("2026-08-22T10:00:00.000Z"), desde, 48)).toBe(false);
        expect(slaVencido(new Date("2026-08-22T10:00:01.000Z"), desde, 48)).toBe(true);
    });

    it("calcularLimiteRetencion coincide con el cálculo de inactividad", () => {
        const ahora = new Date("2026-08-24T12:00:00.000Z");
        expect(calcularLimiteRetencion(ahora, 24).toISOString()).toBe(
            calcularLimiteInactividad(ahora, 24).toISOString()
        );
    });
});
