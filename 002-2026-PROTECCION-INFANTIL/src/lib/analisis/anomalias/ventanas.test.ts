/**
 * SPEC-225 (002-PI-126): tests unitarios de las ventanas temporales del
 * detector (semana calendario America/Bogota y ventana móvil de 24h).
 * Bogotá es UTC-5 todo el año (sin DST), lo que hace las fronteras exactas.
 */
import { describe, it, expect } from "vitest";
import { semanaCalendarioBogota, semanaAnterior, ultimas24h } from "./ventanas";

describe("semanaCalendarioBogota", () => {
    it("devuelve el rango lunes 00:00 → lunes siguiente 00:00 en UTC (Bogotá UTC-5)", () => {
        // Miércoles 2026-08-26 10:00 Bogotá = 15:00 UTC.
        const semana = semanaCalendarioBogota(new Date("2026-08-26T15:00:00Z"));
        expect(semana.claveInicio).toBe("2026-08-24");
        expect(semana.claveFin).toBe("2026-08-30");
        expect(semana.desde.toISOString()).toBe("2026-08-24T05:00:00.000Z");
        expect(semana.hasta.toISOString()).toBe("2026-08-31T05:00:00.000Z");
    });

    it("frontera: domingo 23:59 Bogotá sigue en la semana que cierra", () => {
        // Domingo 2026-08-30 23:59 Bogotá = lunes 2026-08-31 04:59 UTC.
        const semana = semanaCalendarioBogota(new Date("2026-08-31T04:59:00Z"));
        expect(semana.claveInicio).toBe("2026-08-24");
        expect(semana.claveFin).toBe("2026-08-30");
    });

    it("frontera: lunes 00:01 Bogotá abre la semana nueva", () => {
        // Lunes 2026-08-31 00:01 Bogotá = 05:01 UTC.
        const semana = semanaCalendarioBogota(new Date("2026-08-31T05:01:00Z"));
        expect(semana.claveInicio).toBe("2026-08-31");
        expect(semana.claveFin).toBe("2026-09-06");
        expect(semana.desde.toISOString()).toBe("2026-08-31T05:00:00.000Z");
    });

    it("un instante UTC del lunes 04:59 (domingo en Bogotá) NO abre semana nueva", () => {
        // Aunque en UTC ya es lunes, en Bogotá aún es domingo: misma semana.
        const semana = semanaCalendarioBogota(new Date("2026-08-24T04:59:00Z"));
        expect(semana.claveInicio).toBe("2026-08-17");
        expect(semana.claveFin).toBe("2026-08-23");
    });
});

describe("semanaAnterior", () => {
    it("devuelve la semana inmediatamente anterior, contigua", () => {
        const actual = semanaCalendarioBogota(new Date("2026-08-26T15:00:00Z"));
        const previa = semanaAnterior(actual);
        expect(previa.claveInicio).toBe("2026-08-17");
        expect(previa.claveFin).toBe("2026-08-23");
        expect(previa.hasta.getTime()).toBe(actual.desde.getTime());
        expect(previa.desde.toISOString()).toBe("2026-08-17T05:00:00.000Z");
    });
});

describe("ultimas24h", () => {
    it("devuelve la ventana móvil exacta de 24 horas", () => {
        const ahora = new Date("2026-08-24T13:00:00Z");
        const ventana = ultimas24h(ahora);
        expect(ventana.hasta.getTime()).toBe(ahora.getTime());
        expect(ventana.desde.toISOString()).toBe("2026-08-23T13:00:00.000Z");
    });
});
