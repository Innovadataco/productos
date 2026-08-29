/**
 * SPEC-237 (002-PI-mega-cola): tests unitarios de los helpers de SLA.
 * Cubre T036: cálculo en zona America/Bogota y semáforo pino/ambar/rubi.
 */
import { describe, it, expect } from "vitest";
import {
    calcularFechaLimiteSla,
    colorIndicadorSla,
    construirSla,
    formatearEnBogota,
    ZONA_BOGOTA,
} from "./sla";

describe("calcularFechaLimiteSla", () => {
    it("suma las horas del SLA a la fecha de creación", () => {
        const creado = new Date("2026-08-22T15:00:00.000Z");
        const limite = calcularFechaLimiteSla(creado, 72);
        expect(limite.toISOString()).toBe("2026-08-25T15:00:00.000Z");
    });
});

describe("colorIndicadorSla", () => {
    const ahora = new Date("2026-08-24T15:00:00.000Z");

    it("pino cuando la fecha límite está a más de 24 h", () => {
        const limite = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);
        expect(colorIndicadorSla(limite, ahora)).toBe("pino");
    });

    it("ambar cuando faltan menos de 24 h", () => {
        const limite = new Date(ahora.getTime() + 12 * 60 * 60 * 1000);
        expect(colorIndicadorSla(limite, ahora)).toBe("ambar");
    });

    it("rubi cuando la fecha límite ya pasó", () => {
        const limite = new Date(ahora.getTime() - 1000);
        expect(colorIndicadorSla(limite, ahora)).toBe("rubi");
    });

    it("ambar en el borde exacto de 24 h aún no vencido", () => {
        const limite = new Date(ahora.getTime() + 24 * 60 * 60 * 1000 - 1);
        expect(colorIndicadorSla(limite, ahora)).toBe("ambar");
    });
});

describe("construirSla", () => {
    it("devuelve fecha límite en ISO con offset de Bogotá (-05:00)", () => {
        const creado = new Date("2026-08-22T15:00:00.000Z");
        const sla = construirSla(creado, 72, new Date("2026-08-22T16:00:00.000Z"));
        expect(sla.fechaLimite).toBe("2026-08-25T10:00:00-05:00");
        expect(sla.color).toBe("pino");
        expect(sla.vencido).toBe(false);
    });

    it("marca vencido cuando el SLA ya pasó", () => {
        const creado = new Date("2026-08-20T15:00:00.000Z");
        const sla = construirSla(creado, 72, new Date("2026-08-24T16:00:00.000Z"));
        expect(sla.color).toBe("rubi");
        expect(sla.vencido).toBe(true);
    });
});

describe("formatearEnBogota", () => {
    it("formatea en zona America/Bogota independientemente del servidor", () => {
        // 15:00 UTC = 10:00 Bogotá (UTC-5, sin DST).
        const fecha = new Date("2026-08-22T15:30:00.000Z");
        expect(formatearEnBogota(fecha)).toBe("2026-08-22 10:30");
        expect(ZONA_BOGOTA).toBe("America/Bogota");
    });
});
