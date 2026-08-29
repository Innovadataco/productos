/**
 * SPEC-147 (T005) — CursoHeader: volver, nombre, titular (o "sin titular
 * asignado", inactivo marcado), conteo de estudiantes y botón editar.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CursoHeader } from "./CursoHeader";

describe("CursoHeader", () => {
    it("muestra volver, nombre, titular y conteo, con botón editar", () => {
        const onEditar = vi.fn();
        render(
            <CursoHeader
                nombre="8-B"
                estadoCurso="activo"
                titular={{ nombre: "María", apellidos: "López", estado: "activo" }}
                totalEstudiantes={27}
                onEditar={onEditar}
            />
        );
        expect(screen.getByRole("link", { name: /Volver a cursos/ }).getAttribute("href")).toBe("/dashboard/colegio/cursos");
        expect(screen.getByRole("heading", { name: /8-B/ })).toBeTruthy();
        expect(screen.getByText(/Prof\. titular: María López/)).toBeTruthy();
        expect(screen.getByText(/27 estudiantes/)).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Editar curso" }));
        expect(onEditar).toHaveBeenCalledTimes(1);
    });

    it("sin titular: 'Sin titular asignado'", () => {
        render(<CursoHeader nombre="6-A" estadoCurso="activo" titular={null} totalEstudiantes={10} onEditar={vi.fn()} />);
        expect(screen.getByText(/Sin titular asignado/)).toBeTruthy();
    });

    it("titular inactivo se muestra marcado (COND-2 de SPEC-145)", () => {
        render(
            <CursoHeader
                nombre="7-C"
                estadoCurso="activo"
                titular={{ nombre: "Ana", apellidos: "Ruiz", estado: "inactivo" }}
                totalEstudiantes={1}
                onEditar={vi.fn()}
            />
        );
        expect(screen.getByText(/Prof\. titular: Ana Ruiz/)).toBeTruthy();
        expect(screen.getByText("· inactivo")).toBeTruthy();
        expect(screen.getByText(/1 estudiante$/)).toBeTruthy();
    });

    it("curso inactivo: nombre marcado con badge", () => {
        render(<CursoHeader nombre="11-Z" estadoCurso="inactivo" titular={null} totalEstudiantes={0} onEditar={vi.fn()} />);
        expect(screen.getByText("inactivo")).toBeTruthy();
    });
});
