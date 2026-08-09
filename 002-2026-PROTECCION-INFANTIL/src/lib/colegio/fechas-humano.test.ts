/**
 * SPEC-143 — Tests de las fechas en lenguaje humano (sin librerías).
 */
import { describe, it, expect } from "vitest";
import { fechaLargaES, relativoHumano, etiquetaPeriodo } from "./fechas-humano";

describe("fechaLargaES", () => {
    it("formatea en español: 'lunes 3 de agosto de 2026'", () => {
        // 2026-08-03 es lunes (hora local mediodía para no depender de la zona).
        expect(fechaLargaES(new Date(2026, 7, 3, 12, 0, 0))).toBe("lunes 3 de agosto de 2026");
    });

    it("usa tildes y nombres correctos (miércoles, febrero)", () => {
        // 2026-02-18 es miércoles.
        expect(fechaLargaES(new Date(2026, 1, 18, 12, 0, 0))).toBe("miércoles 18 de febrero de 2026");
    });
});

describe("relativoHumano", () => {
    const ahora = new Date(2026, 7, 3, 12, 0, 0);

    it("'hace un momento' por debajo de un minuto", () => {
        expect(relativoHumano(new Date(ahora.getTime() - 30_000), ahora)).toBe("hace un momento");
    });

    it("'hace 12 minutos' con plural y singular correctos", () => {
        expect(relativoHumano(new Date(ahora.getTime() - 12 * 60_000), ahora)).toBe("hace 12 minutos");
        expect(relativoHumano(new Date(ahora.getTime() - 60_000), ahora)).toBe("hace 1 minuto");
    });

    it("horas y días con tilde en 'día'", () => {
        expect(relativoHumano(new Date(ahora.getTime() - 3 * 3_600_000), ahora)).toBe("hace 3 horas");
        expect(relativoHumano(new Date(ahora.getTime() - 3_600_000), ahora)).toBe("hace 1 hora");
        expect(relativoHumano(new Date(ahora.getTime() - 2 * 86_400_000), ahora)).toBe("hace 2 días");
    });

    it("a partir de 60 días cae a fecha corta", () => {
        expect(relativoHumano(new Date(2026, 4, 10, 12, 0, 0), ahora)).toBe("el 10 may 2026");
    });

    it("fecha futura no rompe: 'justo ahora'", () => {
        expect(relativoHumano(new Date(ahora.getTime() + 60_000), ahora)).toBe("justo ahora");
    });
});

describe("etiquetaPeriodo", () => {
    it("mensual: 'sep 2026'", () => {
        expect(etiquetaPeriodo("2026-09-01T00:00:00.000Z", "mensual")).toBe("sep 2026");
    });

    it("semanal: día de inicio de la semana '27 jul'", () => {
        expect(etiquetaPeriodo("2026-07-27T00:00:00.000Z", "semanal")).toBe("27 jul");
    });

    it("anual: solo el año", () => {
        expect(etiquetaPeriodo("2026-01-01T00:00:00.000Z", "anual")).toBe("2026");
    });

    it("periodo inválido se devuelve tal cual (no rompe el render)", () => {
        expect(etiquetaPeriodo("no-es-fecha", "mensual")).toBe("no-es-fecha");
    });
});
