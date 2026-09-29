/**
 * CANDADO · SPEC-773 · la hora de una franja sembrada cae en la ventana de Bogotá.
 *
 * El defecto era `setHours` en un contenedor UTC: `setHours(9)` = 9:00 UTC = 4am Bogotá,
 * y conservar la hora de la corrida dejaba franjas a las 2am. Este candado fija que
 * `franjaBogota` produce la hora EN ZONA DE BOGOTÁ y dentro de [7,19], para cualquier
 * hora pretendida — control positivo (las horas que pasan los sembradores) + el clamp
 * de las madrugadas (el defecto real). PURO, sin BD.
 */
import { describe, it, expect } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { franjaBogota, HORA_FRANJA_MIN, HORA_FRANJA_MAX } from "./lib/franja-hora-bogota";

const TZ = "America/Bogota";
const horaBogota = (d: Date): number => Number(formatInTimeZone(d, TZ, "HH"));

// Base cualquiera (mediodía UTC = 7am Bogotá); lo que se prueba es la HORA en Bogotá, no el día.
const base = new Date("2026-06-15T12:00:00Z");

describe("SPEC-773 · franjaBogota — hora de franja en la ventana de Bogotá", () => {
    it("una hora dentro de la ventana se respeta EN BOGOTÁ (no en UTC)", () => {
        for (const h of [7, 9, 12, 17, 19]) {
            expect(horaBogota(franjaBogota(base, 50, h).inicio), `hora ${h}`).toBe(h);
        }
    });

    it("toda hora pretendida (0..23) cae dentro de [7,19] en Bogotá (clamp)", () => {
        for (let h = 0; h <= 23; h++) {
            const hb = horaBogota(franjaBogota(base, 50, h).inicio);
            expect(hb, `hora ${h} → ${hb}, fuera de ventana`).toBeGreaterThanOrEqual(HORA_FRANJA_MIN);
            expect(hb, `hora ${h} → ${hb}, fuera de ventana`).toBeLessThanOrEqual(HORA_FRANJA_MAX);
        }
    });

    it("el defecto real (madrugada 0–6am, incl. las 2am) se sube al piso 7am", () => {
        for (const h of [0, 2, 4, 6]) {
            expect(horaBogota(franjaBogota(base, 50, h).inicio)).toBe(HORA_FRANJA_MIN);
        }
    });

    it("fin = inicio + duración, y el start tope (19:00) + 50 min sigue < 20:00", () => {
        const { inicio, fin } = franjaBogota(base, 50, HORA_FRANJA_MAX);
        expect(fin.getTime() - inicio.getTime()).toBe(50 * 60 * 1000);
        expect(horaBogota(fin), "19:00 + 50 min = 19:50 → hora 19, dentro del riel 7am–8pm").toBeLessThan(20);
    });

    it("los valores que pasan los sembradores (9..17) se respetan tal cual en Bogotá", () => {
        for (const h of [9, 10, 11, 12, 13, 14, 15, 16, 17]) {
            expect(horaBogota(franjaBogota(base, 50, h).inicio)).toBe(h);
        }
    });
});
