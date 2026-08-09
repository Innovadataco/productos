/**
 * SPEC-158 (T006, US3, FR-005) — BarrasPorCurso: barras con nombre y conteo D2
 * de 30 días, enlace a la vista del curso, tap target ≥ 48px y copy positivo
 * sin actividad.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarrasPorCurso } from "./BarrasPorCurso";

const CURSOS = [
    { cursoId: "c1", nombre: "8-B", reportes30d: 4 },
    { cursoId: "c2", nombre: "10-A", reportes30d: 1 },
];

describe("BarrasPorCurso", () => {
    it("lista los cursos con conteo y enlace a su vista", () => {
        render(<BarrasPorCurso cursos={CURSOS} />);
        expect(screen.getByText("8-B")).toBeTruthy();
        expect(screen.getByText("4 reportes")).toBeTruthy();
        expect(screen.getByText("1 reporte")).toBeTruthy();
        const enlace = screen.getByRole("link", { name: /8-B/ });
        expect(enlace.getAttribute("href")).toBe("/dashboard/colegio/cursos/c1");
        expect(enlace.className).toContain("min-h-12"); // tap target ≥ 48px
        // La barra de datos existe por curso (SVG propio, aria-hidden).
        expect(document.querySelector('[data-barra="c1"]')).toBeTruthy();
        expect(document.querySelector('[data-barra="c2"]')).toBeTruthy();
    });

    it("sin actividad: copy positivo (cursos en calma)", () => {
        render(<BarrasPorCurso cursos={[]} />);
        expect(screen.getByText(/Ningún curso con reportes en los últimos 30 días/)).toBeTruthy();
        expect(screen.getByText(/en calma/)).toBeTruthy();
    });
});
