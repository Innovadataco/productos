/**
 * SPEC-143 (T007, SC-004) — TendenciaReportes: toggle semanal/mensual/anual que
 * repinta client-side SIN refetch (las 3 series llegan por props), resumen sr-only
 * accesible y total del periodo. ResizeObserver se stubea: jsdom no lo trae y
 * Recharts ResponsiveContainer lo requiere.
 */
import React from "react";
import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TendenciaReportes } from "./TendenciaReportes";
import type { PuntoTendencia } from "@/lib/dal/repositories/colegio-resumen";

beforeAll(() => {
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverStub, writable: true });
});

function serie(cantidad: number, reportes: number): PuntoTendencia[] {
    return Array.from({ length: cantidad }, (_, i) => ({
        periodo: new Date(Date.UTC(2026, 0, 1 + i * 7)).toISOString(),
        reportes,
    }));
}

const PROPS = {
    semanal: serie(12, 1), // total 12
    mensual: serie(12, 2), // total 24
    anual: serie(3, 10), // total 30
};

describe("TendenciaReportes", () => {
    it("arranca en semanal con el total del periodo y el resumen accesible", () => {
        render(<TendenciaReportes {...PROPS} />);
        expect(screen.getByRole("button", { name: "Semanal" }).getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByText(/Total 12 semanas:/).textContent).toContain("12");
        expect(screen.getByRole("status").textContent).toContain("12 reportes en las últimas 12 semanas");
    });

    it("el toggle repinta SIN refetch: cambia el total visible y el resumen sr-only", () => {
        render(<TendenciaReportes {...PROPS} />);

        fireEvent.click(screen.getByRole("button", { name: "Mensual" }));
        expect(screen.getByRole("button", { name: "Mensual" }).getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByRole("button", { name: "Semanal" }).getAttribute("aria-pressed")).toBe("false");
        expect(screen.getByText(/Total 12 meses:/).textContent).toContain("24");
        expect(screen.getByRole("status").textContent).toContain("24 reportes en las últimas 12 meses");

        fireEvent.click(screen.getByRole("button", { name: "Anual" }));
        expect(screen.getByText(/Total 3 años:/).textContent).toContain("30");
        expect(screen.getByRole("status").textContent).toContain("30 reportes en las últimas 3 años");
    });

    it("los botones del toggle cumplen tap target mínimo (min-h-12 = 48px)", () => {
        render(<TendenciaReportes {...PROPS} />);
        for (const nombre of ["Semanal", "Mensual", "Anual"]) {
            expect(screen.getByRole("button", { name: nombre }).className).toContain("min-h-12");
        }
    });
});
