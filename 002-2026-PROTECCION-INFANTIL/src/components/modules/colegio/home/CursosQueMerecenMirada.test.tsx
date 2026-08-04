/**
 * SPEC-143 (T007) — CursosQueMerecenMirada: top con titular (o "sin titular
 * asignado"), enlace al curso y copy positivo sin actividad.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CursosQueMerecenMirada } from "./CursosQueMerecenMirada";

const CURSOS = [
    { cursoId: "c1", nombre: "8-B", profesorTitular: "María López", alertas30d: 2 },
    { cursoId: "c2", nombre: "10-A", profesorTitular: null, alertas30d: 1 },
];

describe("CursosQueMerecenMirada", () => {
    it("lista los cursos con titular, conteo y enlace al curso", () => {
        render(<CursosQueMerecenMirada cursos={CURSOS} />);
        expect(screen.getByText("8-B")).toBeTruthy();
        expect(screen.getByText("Prof. María López")).toBeTruthy();
        expect(screen.getByText("Sin titular asignado")).toBeTruthy();
        expect(screen.getByText(/2 reportes · 30 días/)).toBeTruthy();
        const enlace = screen.getByRole("link", { name: /8-B/ });
        expect(enlace.getAttribute("href")).toBe("/dashboard/colegio/cursos/c1");
    });

    it("sin actividad: copy positivo (ningún curso con reportes recientes)", () => {
        render(<CursosQueMerecenMirada cursos={[]} />);
        expect(screen.getByText(/Ningún curso con reportes en los últimos 30 días/)).toBeTruthy();
        expect(screen.getByText(/en calma/)).toBeTruthy();
    });

    it("siempre ofrece el verbo: ver todos los cursos", () => {
        render(<CursosQueMerecenMirada cursos={[]} />);
        const enlace = screen.getByRole("link", { name: /Ver todos los cursos/ });
        expect(enlace.getAttribute("href")).toBe("/dashboard/colegio/cursos");
    });
});
