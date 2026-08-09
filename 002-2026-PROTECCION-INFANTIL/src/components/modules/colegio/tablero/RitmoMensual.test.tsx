/**
 * SPEC-158 (T006, US3, FR-005) — RitmoMensual: serie mensual (12 puntos, D2)
 * con el patrón de TendenciaReportes — resumen sr-only y total del periodo.
 * ResizeObserver se stubea: jsdom no lo trae y ResponsiveContainer lo requiere.
 */
import React from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { RitmoMensual } from "./RitmoMensual";
import type { PuntoTendencia } from "@/lib/dal/repositories/colegio-resumen";

beforeAll(() => {
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub, writable: true });
});

function serie(reportes: number): PuntoTendencia[] {
    return Array.from({ length: 12 }, (_, i) => ({
        periodo: new Date(Date.UTC(2025, 8 + i, 1)).toISOString(),
        reportes,
    }));
}

describe("RitmoMensual", () => {
    it("muestra el total de los últimos 12 meses y el resumen accesible", () => {
        render(<RitmoMensual puntos={serie(2)} />);
        expect(screen.getByRole("region", { name: "Ritmo mensual de reportes" })).toBeTruthy();
        expect(screen.getByText(/Total 12 meses:/).textContent).toContain("24");
        expect(screen.getByRole("status").textContent).toContain("24 reportes en los últimos 12 meses");
    });

    it("serie en ceros: total cero honesto, sin romperse", () => {
        render(<RitmoMensual puntos={serie(0)} />);
        expect(screen.getByRole("status").textContent).toContain("0 reportes en los últimos 12 meses");
    });
});
