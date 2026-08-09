/**
 * SPEC-143 (T008) — AccionesRapidas: 4 verbos a rutas existentes, terminología §3
 * ("subir lista", nunca "carga masiva") y tap targets ≥ 48px.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccionesRapidas } from "./AccionesRapidas";

describe("AccionesRapidas", () => {
    it("ofrece las 4 acciones con sus rutas existentes", () => {
        render(<AccionesRapidas />);
        const esperadas: [RegExp, string][] = [
            [/Crear curso y estudiantes/, "/dashboard/colegio/cursos/unificado"],
            [/Subir lista en Excel/, "/dashboard/colegio/cursos/unificado?modo=excel"],
            // Profesores apunta a cursos hasta que SPEC-148 cree su ruta (documentado).
            [/Profesores/, "/dashboard/colegio/cursos"],
            [/Ver estudiantes/, "/dashboard/colegio/cursos"],
        ];
        for (const [nombre, href] of esperadas) {
            const enlace = screen.getByRole("link", { name: nombre });
            expect(enlace.getAttribute("href")).toBe(href);
            expect(enlace.className).toContain("min-h-12"); // tap target ≥ 48px
        }
    });

    it("terminología §3: usa 'subir lista' y jamás 'carga masiva' ni 'gestión'", () => {
        const { container } = render(<AccionesRapidas />);
        const texto = container.textContent ?? "";
        expect(texto).toContain("Subir lista");
        expect(texto).not.toMatch(/carga masiva/i);
        expect(texto).not.toMatch(/gestión/i);
        expect(texto).not.toMatch(/alumno/i);
    });
});
