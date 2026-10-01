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

// SPEC-795 · CANDADO de frontera de fin de mes: la suma de meses CLAMPA al último día del mes
// destino, NUNCA desborda. Fechas FIJAS (28/29/30/31) cruzando meses de distinta longitud; nada
// depende de cuándo corre. El valor esperado es un LITERAL — NUNCA una llamada a la función bajo
// prueba ni a su primitiva (`addMonths`/`setMonth`): un oráculo que invoca lo que prueba es
// estructuralmente incapaz de fallar (la lección del oráculo tautológico de SPEC-795).
// CONTROL POSITIVO: con el `Date.setMonth` nativo anterior (que DESBORDA) estos literales serían
// 03-mar / 01-dic / 01-may / 03-mar / 01-mar — el test CAE si alguien revierte a `setMonth`.
// La base va a las 15:00Z = 10:00 Bogotá (mismo día en UTC y Bogotá), así lo único que se mide acá
// es el CLAMP; la dimensión de zona es de la otra clase (SPEC-795 · PR de sitios 1/2/3).
describe("calcularFinServicio · frontera de fin de mes (SPEC-795 · clampa, no desborda)", () => {
    it("MENSUAL 31-ene → 28-feb (no 03-mar)", () => {
        expect(calcularFinServicio(new Date("2026-01-31T15:00:00.000Z"), "MENSUAL")?.toISOString())
            .toBe("2026-02-28T15:00:00.000Z");
    });
    it("MENSUAL 31-oct → 30-nov (no 01-dic)", () => {
        expect(calcularFinServicio(new Date("2026-10-31T15:00:00.000Z"), "MENSUAL")?.toISOString())
            .toBe("2026-11-30T15:00:00.000Z");
    });
    it("MENSUAL 31-mar → 30-abr (no 01-may)", () => {
        expect(calcularFinServicio(new Date("2026-03-31T15:00:00.000Z"), "MENSUAL")?.toISOString())
            .toBe("2026-04-30T15:00:00.000Z");
    });
    it("SEMESTRAL 31-ago → 28-feb del año siguiente (no 03-mar)", () => {
        expect(calcularFinServicio(new Date("2026-08-31T15:00:00.000Z"), "SEMESTRAL")?.toISOString())
            .toBe("2027-02-28T15:00:00.000Z");
    });
    it("ANUAL 29-feb (bisiesto) → 28-feb no bisiesto (no 01-mar)", () => {
        expect(calcularFinServicio(new Date("2024-02-29T15:00:00.000Z"), "ANUAL")?.toISOString())
            .toBe("2025-02-28T15:00:00.000Z");
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
