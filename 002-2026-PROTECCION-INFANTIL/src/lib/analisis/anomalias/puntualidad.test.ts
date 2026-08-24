/**
 * SPEC-225 (002-PI-126): tests unitarios de la puntualidad histórica de pagos
 * (definición operacional H-6: fechaReporte ≤ fechaInicio + meses cubiertos
 * por pagos anteriores + tolerancia de 3 días).
 */
import { describe, it, expect } from "vitest";
import {
    contarPagosPuntuales,
    mesesPorDuracion,
    TOLERANCIA_PUNTUALIDAD_DIAS,
} from "./puntualidad";

const INICIO = new Date("2026-01-10T00:00:00Z");

function pago(duracion: "MES_1" | "MES_2" | "MES_3" | "MES_6" | "MES_12", fechaIso: string) {
    return { duracionCubierta: duracion, fechaReporte: new Date(fechaIso) };
}

describe("mesesPorDuracion", () => {
    it("mapea cada duración de plan a sus meses", () => {
        expect(mesesPorDuracion("MES_1")).toBe(1);
        expect(mesesPorDuracion("MES_2")).toBe(2);
        expect(mesesPorDuracion("MES_3")).toBe(3);
        expect(mesesPorDuracion("MES_6")).toBe(6);
        expect(mesesPorDuracion("MES_12")).toBe(12);
    });
});

describe("contarPagosPuntuales", () => {
    it("lista vacía → 0 puntuales", () => {
        expect(contarPagosPuntuales(INICIO, [])).toBe(0);
    });

    it("primer pago dentro de la tolerancia del alta cuenta como puntual", () => {
        // Reportado 2 días después del alta (tolerancia = 3).
        const pagos = [pago("MES_1", "2026-01-12T00:00:00Z")];
        expect(contarPagosPuntuales(INICIO, pagos)).toBe(1);
        expect(TOLERANCIA_PUNTUALIDAD_DIAS).toBe(3);
    });

    it("renovación en la fecha límite teórica cuenta; tardía no", () => {
        const pagos = [
            pago("MES_1", "2026-01-10T00:00:00Z"), // puntual (alta)
            pago("MES_1", "2026-02-10T00:00:00Z"), // puntual (límite exacto)
            pago("MES_1", "2026-03-20T00:00:00Z"), // tardío (límite 2026-03-10 + 3d)
        ];
        expect(contarPagosPuntuales(INICIO, pagos)).toBe(2);
    });

    it("la cobertura acumulada respeta las duraciones de cada pago", () => {
        const pagos = [
            pago("MES_6", "2026-01-10T00:00:00Z"), // cubre ene–jun
            pago("MES_1", "2026-07-09T00:00:00Z"), // límite 2026-07-10 + 3d → puntual
        ];
        expect(contarPagosPuntuales(INICIO, pagos)).toBe(2);
    });

    it("el orden de entrada no altera el resultado", () => {
        const pagos = [
            pago("MES_1", "2026-02-10T00:00:00Z"),
            pago("MES_1", "2026-01-10T00:00:00Z"),
        ];
        expect(contarPagosPuntuales(INICIO, pagos)).toBe(2);
    });
});
