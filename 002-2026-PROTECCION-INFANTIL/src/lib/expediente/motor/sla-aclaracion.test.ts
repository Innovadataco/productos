/**
 * SPEC-238 (002-PI-mega-cola): tests unitarios de los helpers puros del SLA
 * de la aclaración padre-comité (America/Bogota, sin BD). FR-011.
 */
import { describe, it, expect } from "vitest";
import { calcularLimiteSolicitudSla, aclaracionSlaVencida } from "./sla-aclaracion";

describe("SLA de aclaración padre-comité (SPEC-238)", () => {
    it("calcularLimiteSolicitudSla resta las horas exactas del SLA", () => {
        const ahora = new Date("2026-08-22T20:00:00.000Z");
        const limite = calcularLimiteSolicitudSla(ahora, 48);
        expect(limite.toISOString()).toBe("2026-08-20T20:00:00.000Z");
    });

    it("aclaracionSlaVencida es true cuando solicitadaEn + SLA ya pasó", () => {
        const solicitadaEn = new Date("2026-08-20T15:00:00.000Z"); // Bogotá 10:00
        const ahora = new Date("2026-08-22T15:00:00.001Z");
        expect(aclaracionSlaVencida(solicitadaEn, 48, ahora)).toBe(true);
    });

    it("aclaracionSlaVencida es false en el instante exacto del vencimiento", () => {
        const solicitadaEn = new Date("2026-08-20T15:00:00.000Z");
        const ahoraExacta = new Date("2026-08-22T15:00:00.000Z");
        expect(aclaracionSlaVencida(solicitadaEn, 48, ahoraExacta)).toBe(false);
    });

    it("aclaracionSlaVencida es false cuando aún no vence", () => {
        const solicitadaEn = new Date("2026-08-22T10:00:00.000Z");
        const ahora = new Date("2026-08-22T20:00:00.000Z");
        expect(aclaracionSlaVencida(solicitadaEn, 48, ahora)).toBe(false);
    });

    it("el límite es coherente con aclaracionSlaVencida (frontera)", () => {
        const ahora = new Date("2026-08-24T09:00:00.000Z");
        const limite = calcularLimiteSolicitudSla(ahora, 12);
        // Una solicitud justo en el límite NO está vencida (lt estricto en BD).
        expect(aclaracionSlaVencida(limite, 12, ahora)).toBe(false);
        // Un milisegundo antes del límite SÍ lo está.
        expect(aclaracionSlaVencida(new Date(limite.getTime() - 1), 12, ahora)).toBe(true);
    });
});
