/**
 * SPEC-234 (002-PI-134): tests de la regla N1 de aceleración.
 */
import { describe, it, expect } from "vitest";
import { crearEvento } from "../test-fixtures";
import { detectarAceleracion } from "./aceleracion";

function eventosConIntervalos(intervalosDias: number[]) {
    const base = new Date("2026-08-01T00:00:00Z").getTime();
    let acumulado = 0;
    return intervalosDias.map((dias, i) => {
        acumulado += dias * 24 * 60 * 60 * 1000;
        return crearEvento({
            ordenSecuencial: i + 1,
            fechaEvento: new Date(base + acumulado),
        });
    });
}

describe("detectarAceleracion", () => {
    it("dispara cuando los intervalos recientes se acortan respecto a los históricos", () => {
        // histórico: 10 días, reciente: 2 días -> ratio 5
        const eventos = eventosConIntervalos([0, 10, 10, 2, 2]);
        const resultado = detectarAceleracion(eventos, 2);

        expect(resultado.detectado).toBe(true);
        expect(resultado.severidad).toBe("ALTA");
        expect(resultado.datosContextoJson.tipoPatron).toBe("ACELERACION");
        expect(resultado.datosContextoJson.ratio).toBeGreaterThanOrEqual(4);
    });

    it("no dispara cuando los intervalos se mantienen estables", () => {
        const eventos = eventosConIntervalos([0, 5, 5, 5, 5]);
        const resultado = detectarAceleracion(eventos, 2);

        expect(resultado.detectado).toBe(false);
        expect(resultado.severidad).toBe("BAJA");
    });

    it("no dispara con menos de 3 eventos", () => {
        const eventos = eventosConIntervalos([0, 1]);
        const resultado = detectarAceleracion(eventos, 2);

        expect(resultado.detectado).toBe(false);
        expect(resultado.datosContextoJson.totalEventos).toBe(2);
    });
});
