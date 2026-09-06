/**
 * SPEC-143 (T008, §5.2) — EmptyStateColegio: hero + celebración + CTA gigante al
 * primer curso + vía Excel. Es el primer día del colegio, no un tablero de ceros.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyStateColegio } from "./EmptyStateColegio";

describe("EmptyStateColegio", () => {
    it("muestra el hero, la celebración y el nombre del colegio", () => {
        render(<EmptyStateColegio colegioNombre="Colegio San José" />);
        expect(screen.getByText("Colegio San José")).toBeTruthy();
        expect(screen.getByRole("img", { name: /Escudo de protección/ })).toBeTruthy();
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Su colegio está listo para empezar");
        expect(screen.getByText(/Comencemos creando su primer curso/)).toBeTruthy();
    });

    it("CTA gigante al primer curso y vía alternativa de Excel", () => {
        render(<EmptyStateColegio colegioNombre="X" />);
        const cta = screen.getByRole("link", { name: /Crear primer curso/ });
        expect(cta.getAttribute("href")).toBe("/dashboard/colegio/cursos/unificado");
        expect(cta.className).toContain("min-h-12");
        const excel = screen.getByRole("link", { name: /Subirla y creamos todo por usted/ });
        expect(excel.getAttribute("href")).toBe("/dashboard/colegio/cursos/unificado?modo=excel");
        expect(screen.getByText(/¿Ya tiene su lista en Excel\?/)).toBeTruthy();
    });
});
