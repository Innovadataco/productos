import { describe, it, expect } from "vitest";
import { fechaCorta, fechaHora, fechaISO, fechaHoraSinMinutos, aHoraEnPunto, partesHoraLocal, desdePartesHoraLocal} from "./fecha";

describe("SPEC-208: helpers de fecha centralizados", () => {
    it("devuelve '—' para null, undefined e inválido", () => {
        expect(fechaCorta(null)).toBe("—");
        expect(fechaCorta(undefined)).toBe("—");
        expect(fechaCorta("")).toBe("—");
        expect(fechaCorta("no-es-fecha")).toBe("—");

        expect(fechaHora(null)).toBe("—");
        expect(fechaISO(null)).toBe("—");
    });

    it("fechaCorta usa timezone America/Bogota", () => {
        const iso = "2026-08-22T04:00:00.000Z"; // medianoche en Bogotá del 22
        const esperado = new Intl.DateTimeFormat("es-CO", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "America/Bogota",
        }).format(new Date(iso));
        expect(fechaCorta(iso)).toBe(esperado);
    });

    it("fechaHora incluye fecha y hora en Bogotá", () => {
        const iso = "2026-08-22T20:30:00.000Z";
        const fecha = new Intl.DateTimeFormat("es-CO", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "America/Bogota",
        }).format(new Date(iso));
        const hora = new Intl.DateTimeFormat("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "America/Bogota",
        }).format(new Date(iso));
        expect(fechaHora(iso)).toBe(`${fecha} · ${hora}`);
    });

    it("fechaISO devuelve yyyy-MM-dd en timezone Bogotá", () => {
        // 22 ago 2026 15:00 UTC = 22 ago 2026 10:00 Bogotá (UTC-5).
        expect(fechaISO("2026-08-22T15:00:00.000Z")).toBe("2026-08-22");

        // Límite: 22 ago 2026 05:00 UTC = 22 ago 2026 00:00 Bogotá.
        expect(fechaISO("2026-08-22T05:00:00.000Z")).toBe("2026-08-22");

        // Justo antes del límite: 22 ago 2026 04:59 UTC = 21 ago 2026 23:59 Bogotá.
        expect(fechaISO("2026-08-22T04:59:00.000Z")).toBe("2026-08-21");

        // Fecha con offset explícito de Bogotá.
        expect(fechaISO("2026-08-22T23:00:00.000-05:00")).toBe("2026-08-22");
    });
});

// ─── A-70 · G20 · la fecha del hecho sin minutos ────────────────────────────
describe("fechaHoraSinMinutos (A-70 · G20)", () => {
    it("muestra día + hora con a.m./p.m. y SIN minutos", () => {
        // 2026-08-30 21:15 Bogotá = 2026-08-31T02:15Z
        const salida = fechaHoraSinMinutos("2026-08-31T02:15:00.000Z");
        expect(salida).toContain("30");
        expect(salida).toContain("ago");
        expect(salida).toContain("2026");
        expect(salida, "la hora va en formato 12h").toMatch(/9\s*p/i);
        expect(salida, "el minuto NO aparece").not.toContain("15");
        expect(salida).not.toContain(":");
    });

    it("una hora de la mañana sale como a.m.", () => {
        // 2026-08-30 09:40 Bogotá = 14:40Z
        const salida = fechaHoraSinMinutos("2026-08-30T14:40:00.000Z");
        expect(salida).toMatch(/9\s*a/i);
        expect(salida).not.toContain("40");
    });

    it("valores vacíos o inválidos devuelven el guion, no una fecha falsa", () => {
        expect(fechaHoraSinMinutos(null)).toBe("—");
        expect(fechaHoraSinMinutos(undefined)).toBe("—");
        expect(fechaHoraSinMinutos("no es fecha")).toBe("—");
    });
});

describe("aHoraEnPunto (A-70 · G20 · minutos 00 en BD)", () => {
    it("pone los minutos en 00 conservando día y hora", () => {
        expect(aHoraEnPunto("2026-08-30T21:15")).toBe("2026-08-30T21:00");
        expect(aHoraEnPunto("2026-08-30T09:59")).toBe("2026-08-30T09:00");
    });

    it("una hora ya en punto no cambia", () => {
        expect(aHoraEnPunto("2026-08-30T21:00")).toBe("2026-08-30T21:00");
    });

    it("cadena vacía pasa tal cual (campo sin llenar)", () => {
        expect(aHoraEnPunto("")).toBe("");
    });

    it("valor sin parte de hora no se rompe", () => {
        expect(aHoraEnPunto("2026-08-30")).toBe("2026-08-30");
    });
});

describe("piezas del control amable (A-74 · P1)", () => {
    it("parte el valor en día, hora 1-12 y a.m./p.m.", () => {
        expect(partesHoraLocal("2026-09-02T14:00")).toEqual({ fecha: "2026-09-02", hora12: 2, meridiano: "pm" });
        expect(partesHoraLocal("2026-09-02T09:00")).toEqual({ fecha: "2026-09-02", hora12: 9, meridiano: "am" });
    });

    it("los bordes del reloj de 12: medianoche es 12 a.m. y mediodía es 12 p.m.", () => {
        expect(partesHoraLocal("2026-09-02T00:00")).toEqual({ fecha: "2026-09-02", hora12: 12, meridiano: "am" });
        expect(partesHoraLocal("2026-09-02T12:00")).toEqual({ fecha: "2026-09-02", hora12: 12, meridiano: "pm" });
        expect(desdePartesHoraLocal("2026-09-02", 12, "am")).toBe("2026-09-02T00:00");
        expect(desdePartesHoraLocal("2026-09-02", 12, "pm")).toBe("2026-09-02T12:00");
    });

    it("siempre arma la hora EN PUNTO (candado G20: minutos 00)", () => {
        expect(desdePartesHoraLocal("2026-09-02", 3, "pm")).toBe("2026-09-02T15:00");
        expect(desdePartesHoraLocal("2026-09-02", 3, "am")).toBe("2026-09-02T03:00");
    });

    it("a medio llenar no inventa una fecha: devuelve vacío", () => {
        expect(desdePartesHoraLocal("", 3, "pm")).toBe("");
        expect(desdePartesHoraLocal("2026-09-02", null, "pm")).toBe("");
    });

    it("ida y vuelta: lo que se parte se vuelve a armar igual", () => {
        for (const valor of ["2026-09-02T00:00", "2026-09-02T11:00", "2026-09-02T12:00", "2026-09-02T23:00"]) {
            const { fecha, hora12, meridiano } = partesHoraLocal(valor);
            expect(desdePartesHoraLocal(fecha, hora12, meridiano)).toBe(valor);
        }
    });
});
