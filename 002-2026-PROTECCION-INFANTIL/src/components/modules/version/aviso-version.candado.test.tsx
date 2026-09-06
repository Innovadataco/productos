/**
 * SPEC-548 (I-337) · CANDADO caso (a): el toast de «versión nueva».
 *
 * Vigila la conducta de la forma cerrada por Diseño: copia exacta, acento cielo,
 * NUNCA rubi, NUNCA modal (es un status anclado abajo, no un diálogo que roba el
 * foco), descartable con la × y —clave— que al descartar NO reaparece en la
 * misma vista pero SÍ en la próxima navegación. Muere si desaparece la copia, la
 * ×, o si el descarte se vuelve permanente.
 *
 * Integración (jsdom); no toca vitest.unit.includes.ts.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let pathnameActual = "/dashboard/padre";
let hayNuevaMock = true;
vi.mock("next/navigation", () => ({ usePathname: () => pathnameActual }));
vi.mock("./useDeteccionVersion", () => ({ useDeteccionVersion: () => hayNuevaMock }));

import { AvisoVersionNueva } from "./AvisoVersionNueva";

beforeEach(() => {
    pathnameActual = "/dashboard/padre";
    hayNuevaMock = true;
});

describe("SPEC-548 · toast de versión nueva (caso a)", () => {
    it("muestra la copia EXACTA de Diseño y el botón Actualizar", () => {
        render(<AvisoVersionNueva />);
        expect(screen.getByText("Hay una versión nueva.")).toBeTruthy();
        expect(screen.getByText("Actualiza cuando quieras para tener lo último.")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Actualizar" })).toBeTruthy();
    });

    it("es un status anclado abajo, NO un modal (ni diálogo ni overlay que tape)", () => {
        const { container } = render(<AvisoVersionNueva />);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(container.querySelector('[role="status"]')).toBeTruthy();
        // Nunca un velo que cubra toda la pantalla.
        expect(container.querySelector(".fixed.inset-0")).toBeNull();
    });

    it("acento cielo, CERO rubi (no es alarma)", () => {
        const { container } = render(<AvisoVersionNueva />);
        expect(container.innerHTML).not.toContain("rubi");
        expect(container.innerHTML).toContain("cielo");
    });

    it("la × lo descarta en esta vista pero reaparece al navegar", () => {
        const { container, rerender } = render(<AvisoVersionNueva />);
        fireEvent.click(screen.getByRole("button", { name: /Descartar/ }));
        // Cerrado: ya no hay toast en la vista actual.
        expect(container.querySelector('[role="status"]')).toBeNull();
        // Navegar a otra ruta: reaparece (el descarte era solo de esa vista).
        pathnameActual = "/dashboard/padre/citas";
        rerender(<AvisoVersionNueva />);
        expect(screen.getByText("Hay una versión nueva.")).toBeTruthy();
    });

    it("si no hay versión nueva, no pinta nada", () => {
        hayNuevaMock = false;
        const { container } = render(<AvisoVersionNueva />);
        expect(container.querySelector('[role="status"]')).toBeNull();
    });
});
