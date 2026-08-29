/**
 * SPEC-201: tests del parser de offsets del motor de notificaciones.
 */
import { describe, it, expect } from "vitest";
import { parseOffset, aplicarOffset, TIMEZONE_MOTOR } from "./offset";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

describe("parseOffset", () => {
    it("parsea días negativos", () => {
        const parsed = parseOffset("-5d");
        expect(parsed).toEqual({ signo: -1, cantidad: 5, unidad: "d" });
    });

    it("parsea días positivos", () => {
        const parsed = parseOffset("+2d");
        expect(parsed).toEqual({ signo: 1, cantidad: 2, unidad: "d" });
    });

    it("parsea horas", () => {
        const parsed = parseOffset("-1h");
        expect(parsed).toEqual({ signo: -1, cantidad: 1, unidad: "h" });
    });

    it("parsea minutos inmediatos", () => {
        const parsed = parseOffset("+0m");
        expect(parsed).toEqual({ signo: 1, cantidad: 0, unidad: "m" });
    });

    it("rechaza offsets sin signo", () => {
        expect(() => parseOffset("5d")).toThrow("Offset inválido");
    });

    it("rechaza unidades desconocidas", () => {
        expect(() => parseOffset("+5x")).toThrow("Offset inválido");
    });
});

describe("aplicarOffset", () => {
    it("+0m devuelve la misma fecha", () => {
        const ref = new Date("2026-08-22T10:00:00.000Z");
        const result = aplicarOffset(ref, "+0m");
        expect(result.getTime()).toBe(ref.getTime());
    });

    it("suma horas", () => {
        const ref = new Date("2026-08-22T10:00:00.000Z");
        const result = aplicarOffset(ref, "+3h");
        expect(result.getTime()).toBe(ref.getTime() + 3 * 60 * 60 * 1000);
    });

    it("resta horas", () => {
        const ref = new Date("2026-08-22T10:00:00.000Z");
        const result = aplicarOffset(ref, "-2h");
        expect(result.getTime()).toBe(ref.getTime() - 2 * 60 * 60 * 1000);
    });

    it("suma días calendario conservando hora local de Bogotá", () => {
        // 2026-08-22 22:00 Bogotá = 2026-08-23 03:00 UTC
        const ref = fromZonedTime(new Date(2026, 7, 22, 22, 0, 0), TIMEZONE_MOTOR);
        const result = aplicarOffset(ref, "+1d");
        const resultBogota = toZonedTime(result, TIMEZONE_MOTOR);
        expect(resultBogota.getDate()).toBe(23);
        expect(resultBogota.getHours()).toBe(22);
        expect(resultBogota.getMinutes()).toBe(0);
    });

    it("resta días calendario cerca de medianoche en Bogotá", () => {
        // 2026-08-23 01:00 Bogotá = 2026-08-23 06:00 UTC
        const ref = fromZonedTime(new Date(2026, 7, 23, 1, 0, 0), TIMEZONE_MOTOR);
        const result = aplicarOffset(ref, "-1d");
        const resultBogota = toZonedTime(result, TIMEZONE_MOTOR);
        expect(resultBogota.getDate()).toBe(22);
        expect(resultBogota.getHours()).toBe(1);
    });

    it("suma minutos", () => {
        const ref = new Date("2026-08-22T10:00:00.000Z");
        const result = aplicarOffset(ref, "+45m");
        expect(result.getTime()).toBe(ref.getTime() + 45 * 60 * 1000);
    });
});
