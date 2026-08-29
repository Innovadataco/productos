import { describe, it, expect } from "vitest";
import { fechaCorta, fechaHora, fechaISO } from "./fecha";

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
