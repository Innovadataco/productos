/**
 * SPEC-222 (002-PI-123): tests unitarios de los helpers puros del panel
 * Dinero vs Valor. Sin base de datos.
 */
import { describe, it, expect } from "vitest";
import { DuracionPlan } from "@prisma/client";
import {
    calcularCuadrante,
    mediana,
    calcularSemaforo,
    clasificarCanal,
    deltaPct,
    resolverRangoPeriodo,
    rangoAnteriorEquivalente,
    periodoScoreDeRango,
    claveCohorteBogota,
    mensualizarPrecio,
} from "./panel-calculos";

describe("calcularCuadrante", () => {
    it("clasifica los cuatro cuadrantes", () => {
        expect(calcularCuadrante(100, 80, 50, 50)).toBe("estables");
        expect(calcularCuadrante(100, 20, 50, 50)).toBe("riesgo");
        expect(calcularCuadrante(10, 80, 50, 50)).toBe("oportunidad");
        expect(calcularCuadrante(10, 20, 50, 50)).toBe("atencion");
    });

    it("el valor igual al corte cuenta como alto", () => {
        expect(calcularCuadrante(50, 50, 50, 50)).toBe("estables");
        expect(calcularCuadrante(50, 10, 50, 50)).toBe("riesgo");
    });
});

describe("mediana", () => {
    it("null con lista vacía", () => {
        expect(mediana([])).toBeNull();
    });

    it("impar devuelve el elemento central", () => {
        expect(mediana([5, 1, 9])).toBe(5);
    });

    it("par devuelve el promedio de los dos centrales", () => {
        expect(mediana([1, 3, 5, 9])).toBe(4);
    });

    it("no muta la entrada", () => {
        const entrada = [9, 1, 5];
        mediana(entrada);
        expect(entrada).toEqual([9, 1, 5]);
    });
});

describe("calcularSemaforo", () => {
    it("pino con variación positiva o cero", () => {
        expect(calcularSemaforo(12.4, 25)).toBe("pino");
        expect(calcularSemaforo(0, 25)).toBe("pino");
    });

    it("pino sin base de comparación (null no se castiga)", () => {
        expect(calcularSemaforo(null, 25)).toBe("pino");
    });

    it("ambar con caída dentro del umbral y rubi por encima", () => {
        expect(calcularSemaforo(-10, 25)).toBe("ambar");
        expect(calcularSemaforo(-25, 25)).toBe("ambar");
        expect(calcularSemaforo(-25.1, 25)).toBe("rubi");
    });
});

describe("clasificarCanal (precedencia FR-018)", () => {
    it("referido gana a bono y freemium", () => {
        expect(clasificarCanal({ codigoReferidoUsado: "PI-X", tieneBono: true, esFreemiumConPagoAutorizado: true })).toBe(
            "referido"
        );
    });

    it("bono gana a freemium", () => {
        expect(clasificarCanal({ codigoReferidoUsado: null, tieneBono: true, esFreemiumConPagoAutorizado: true })).toBe(
            "bono"
        );
    });

    it("freemium convertido y directo", () => {
        expect(clasificarCanal({ codigoReferidoUsado: null, tieneBono: false, esFreemiumConPagoAutorizado: true })).toBe(
            "freemium_convertido"
        );
        expect(clasificarCanal({ codigoReferidoUsado: null, tieneBono: false, esFreemiumConPagoAutorizado: false })).toBe(
            "directo"
        );
    });
});

describe("deltaPct", () => {
    it("null sin base (anterior 0)", () => {
        expect(deltaPct(10, 0)).toBeNull();
    });

    it("calcula el porcentaje con signo", () => {
        expect(deltaPct(110, 100)).toBeCloseTo(10);
        expect(deltaPct(90, 100)).toBeCloseTo(-10);
    });
});

describe("resolverRangoPeriodo", () => {
    // 2026-08-24 15:00 UTC = 2026-08-24 10:00 Bogotá.
    const ahora = new Date("2026-08-24T15:00:00Z");

    it("mes = mes calendario Bogotá actual [día 1, día 1 siguiente)", () => {
        const r = resolverRangoPeriodo({ periodo: "mes" }, ahora);
        expect(r.desde.toISOString()).toBe("2026-08-01T05:00:00.000Z");
        expect(r.hasta.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    });

    it("trimestre = 3 meses calendario incluyendo el actual", () => {
        const r = resolverRangoPeriodo({ periodo: "trimestre" }, ahora);
        expect(r.desde.toISOString()).toBe("2026-06-01T05:00:00.000Z");
        expect(r.hasta.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    });

    it("anio = 12 meses calendario incluyendo el actual (cruza año)", () => {
        const r = resolverRangoPeriodo({ periodo: "anio" }, ahora);
        expect(r.desde.toISOString()).toBe("2025-09-01T05:00:00.000Z");
        expect(r.hasta.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    });

    it("custom cubre desde..hasta ambos inclusive", () => {
        const r = resolverRangoPeriodo({ periodo: "custom", desde: "2026-08-10", hasta: "2026-08-20" }, ahora);
        expect(r.desde.toISOString()).toBe("2026-08-10T05:00:00.000Z");
        expect(r.hasta.toISOString()).toBe("2026-08-21T05:00:00.000Z");
    });

    it("custom sin fechas lanza error", () => {
        expect(() => resolverRangoPeriodo({ periodo: "custom" }, ahora)).toThrow();
    });

    it("rangoAnteriorEquivalente devuelve la ventana inmediatamente anterior", () => {
        const r = resolverRangoPeriodo({ periodo: "mes" }, ahora);
        const prev = rangoAnteriorEquivalente(r);
        expect(prev.hasta.getTime()).toBe(r.desde.getTime());
        expect(prev.hasta.getTime() - prev.desde.getTime()).toBe(r.hasta.getTime() - r.desde.getTime());
    });
});

describe("periodoScoreDeRango / claveCohorteBogota", () => {
    it("período del snapshot = mes Bogotá del último día del rango", () => {
        const r = resolverRangoPeriodo({ periodo: "custom", desde: "2026-07-01", hasta: "2026-08-20" });
        expect(periodoScoreDeRango(r)).toBe("2026-08");
    });

    it("clave de cohorte en mes calendario Bogotá", () => {
        // 2026-08-01 02:00 UTC = 2026-07-31 21:00 Bogotá → cohorte 2026-07.
        expect(claveCohorteBogota(new Date("2026-08-01T02:00:00Z"))).toBe("2026-07");
        expect(claveCohorteBogota(new Date("2026-08-01T06:00:00Z"))).toBe("2026-08");
    });
});

describe("mensualizarPrecio", () => {
    it("divide el precio entre los meses de duración del plan", () => {
        expect(mensualizarPrecio(120, DuracionPlan.MES_12)).toBeCloseTo(10);
        expect(mensualizarPrecio(30, DuracionPlan.MES_3)).toBeCloseTo(10);
        expect(mensualizarPrecio(10, DuracionPlan.MES_1)).toBeCloseTo(10);
    });
});
