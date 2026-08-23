/**
 * SPEC-201: tests de quiet hours del motor de notificaciones.
 */
import { describe, it, expect } from "vitest";
import { aplicarQuietHours, DEFAULT_QUIET_HOURS } from "./quiet-hours";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { TIMEZONE_MOTOR } from "./offset";

describe("aplicarQuietHours", () => {
    it("no altera horarios fuera de la ventana de silencio", () => {
        // 10:00 Bogotá está fuera de 20:00-07:00
        const enviarEn = fromZonedTime(new Date(2026, 7, 22, 10, 0, 0), TIMEZONE_MOTOR);
        const result = aplicarQuietHours(enviarEn, DEFAULT_QUIET_HOURS);
        expect(result.getTime()).toBe(enviarEn.getTime());
    });

    it("difiere una hora nocturna al día siguiente", () => {
        // 22:00 Bogotá → 07:00 del día siguiente Bogotá
        const enviarEn = fromZonedTime(new Date(2026, 7, 22, 22, 0, 0), TIMEZONE_MOTOR);
        const result = aplicarQuietHours(enviarEn, DEFAULT_QUIET_HOURS);
        const resultBogota = toZonedTime(result, TIMEZONE_MOTOR);
        expect(resultBogota.getDate()).toBe(23);
        expect(resultBogota.getHours()).toBe(7);
        expect(resultBogota.getMinutes()).toBe(0);
    });

    it("difiere la madrugada al mismo día", () => {
        // 05:00 Bogotá → 07:00 del mismo día
        const enviarEn = fromZonedTime(new Date(2026, 7, 22, 5, 0, 0), TIMEZONE_MOTOR);
        const result = aplicarQuietHours(enviarEn, DEFAULT_QUIET_HOURS);
        const resultBogota = toZonedTime(result, TIMEZONE_MOTOR);
        expect(resultBogota.getDate()).toBe(22);
        expect(resultBogota.getHours()).toBe(7);
    });

    it("difiere el inicio exacto de la ventana", () => {
        // 20:00 Bogotá → 07:00 del día siguiente
        const enviarEn = fromZonedTime(new Date(2026, 7, 22, 20, 0, 0), TIMEZONE_MOTOR);
        const result = aplicarQuietHours(enviarEn, DEFAULT_QUIET_HOURS);
        const resultBogota = toZonedTime(result, TIMEZONE_MOTOR);
        expect(resultBogota.getDate()).toBe(23);
        expect(resultBogota.getHours()).toBe(7);
    });

    it("no difiere el fin exacto de la ventana", () => {
        // 07:00 Bogotá ya es hábil
        const enviarEn = fromZonedTime(new Date(2026, 7, 22, 7, 0, 0), TIMEZONE_MOTOR);
        const result = aplicarQuietHours(enviarEn, DEFAULT_QUIET_HOURS);
        expect(result.getTime()).toBe(enviarEn.getTime());
    });

    it("funciona con ventana que no cruza medianoche", () => {
        // 10:00 dentro de 09:00-18:00 → 18:00
        const enviarEn = fromZonedTime(new Date(2026, 7, 22, 10, 0, 0), TIMEZONE_MOTOR);
        const result = aplicarQuietHours(enviarEn, "09:00-18:00");
        const resultBogota = toZonedTime(result, TIMEZONE_MOTOR);
        expect(resultBogota.getDate()).toBe(22);
        expect(resultBogota.getHours()).toBe(18);
    });

    it("rechaza formato inválido", () => {
        expect(() => aplicarQuietHours(new Date(), "invalido")).toThrow("Ventana de silencio inválida");
    });
});
