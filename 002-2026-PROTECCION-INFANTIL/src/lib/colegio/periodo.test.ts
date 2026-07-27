import { describe, it, expect } from "vitest";
import { calcularFinServicio, esRangoServicioValido } from "./periodo";

describe("calcularFinServicio", () => {
    const inicio = new Date("2026-03-10T08:00:00.000Z");

    it("MENSUAL suma 1 mes al inicio", () => {
        const fin = calcularFinServicio(inicio, "MENSUAL");
        expect(fin?.toISOString()).toBe("2026-04-10T08:00:00.000Z");
    });

    it("SEMESTRAL suma 6 meses al inicio", () => {
        const fin = calcularFinServicio(inicio, "SEMESTRAL");
        expect(fin?.toISOString()).toBe("2026-09-10T08:00:00.000Z");
    });

    it("ANUAL suma 1 año al inicio", () => {
        const fin = calcularFinServicio(inicio, "ANUAL");
        expect(fin?.toISOString()).toBe("2027-03-10T08:00:00.000Z");
    });

    it("ANUAL cruza de año correctamente", () => {
        const fin = calcularFinServicio(new Date("2026-11-15T00:00:00.000Z"), "ANUAL");
        expect(fin?.toISOString()).toBe("2027-11-15T00:00:00.000Z");
    });

    it("LIBRE devuelve null (fechas manuales)", () => {
        expect(calcularFinServicio(inicio, "LIBRE")).toBeNull();
    });

    it("no muta la fecha de inicio recibida", () => {
        const copia = new Date(inicio.getTime());
        calcularFinServicio(inicio, "SEMESTRAL");
        expect(inicio.getTime()).toBe(copia.getTime());
    });
});

describe("esRangoServicioValido", () => {
    const inicio = new Date("2026-03-10T08:00:00.000Z");

    it("acepta fin posterior al inicio", () => {
        expect(esRangoServicioValido(inicio, new Date("2026-03-10T08:00:01.000Z"))).toBe(true);
    });

    it("rechaza fin igual al inicio", () => {
        expect(esRangoServicioValido(inicio, new Date(inicio.getTime()))).toBe(false);
    });

    it("rechaza fin anterior al inicio", () => {
        expect(esRangoServicioValido(inicio, new Date("2026-03-09T08:00:00.000Z"))).toBe(false);
    });
});
