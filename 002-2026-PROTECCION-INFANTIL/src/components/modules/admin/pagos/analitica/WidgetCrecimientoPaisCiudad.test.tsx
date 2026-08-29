/**
 * SPEC-218 (002-PI-118): tests unitarios del widget de crecimiento por país
 * (sin BD).
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WidgetCrecimientoPaisCiudad } from "./WidgetCrecimientoPaisCiudad";

describe("WidgetCrecimientoPaisCiudad", () => {
    it("renderiza alertas de cambio >25% y las series por país", () => {
        render(
            <WidgetCrecimientoPaisCiudad
                data={{
                    labels: ["2026-06", "2026-07", "2026-08"],
                    series: [
                        { pais: "CO", data: [10, 12, 18], variacionPct: 50, alerta: "crecimiento_alto" },
                        { pais: "CL", data: [5, 4, 2], variacionPct: -50, alerta: "crecimiento_bajo" },
                        { pais: "MX", data: [3, 3, 3], variacionPct: 0, alerta: null },
                    ],
                }}
            />
        );
        expect(screen.getByText(/CO: \+50% vs mes anterior \(crecimiento alto\)/)).toBeTruthy();
        expect(screen.getByText(/CL: -50% vs mes anterior \(caída fuerte\)/)).toBeTruthy();
        // MX sin alerta: no aparece en la lista de alertas pero sí su serie.
        expect(screen.getAllByRole("alert")).toHaveLength(2);
        expect(screen.getByText("MX")).toBeTruthy();
    });

    it("muestra 'sin base de comparación' cuando el mes anterior es cero", () => {
        render(
            <WidgetCrecimientoPaisCiudad
                data={{
                    labels: ["2026-07", "2026-08"],
                    series: [{ pais: "PE", data: [0, 4], variacionPct: null, alerta: null }],
                }}
            />
        );
        expect(screen.getByText("sin base de comparación")).toBeTruthy();
    });

    it("estado vacío", () => {
        render(<WidgetCrecimientoPaisCiudad data={{ labels: ["2026-08"], series: [] }} />);
        expect(screen.getByText(/No hay altas en los últimos 6 meses/)).toBeTruthy();
    });
});
