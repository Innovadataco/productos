/**
 * SPEC-309 (A-50): tests unitarios del semáforo resumido del home.
 */
import { describe, it, expect } from "vitest";
import { colorSemaforo } from "./home-semaforo";

describe("colorSemaforo", () => {
    it("devuelve VERDE cuando no hay reportes", () => {
        expect(colorSemaforo([])).toBe("VERDE");
    });

    it("devuelve AMBAR cuando hay reportes en revisión", () => {
        const reportes = [{ estado: "REVISION_MANUAL", creadoEn: new Date() }];
        expect(colorSemaforo(reportes)).toBe("AMBAR");
    });

    it("devuelve ROJO cuando hay 3 o más reportes clasificados", () => {
        const reportes = Array.from({ length: 3 }, () => ({
            estado: "CLASIFICADO",
            creadoEn: new Date(),
        }));
        expect(colorSemaforo(reportes)).toBe("ROJO");
    });

    it("devuelve AMBAR con reportes clasificados pero pocos", () => {
        const reportes = [{ estado: "CLASIFICADO", creadoEn: new Date() }];
        expect(colorSemaforo(reportes)).toBe("AMBAR");
    });
});
