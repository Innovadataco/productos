/**
 * SPEC-307 (A-50): tests de renderizado de SugerenciaProactivaCard.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SugerenciaProactivaCard } from "./SugerenciaProactivaCard";
import type { SugerenciaProactiva as SugerenciaData } from "@/lib/padre/sugerencia-proactiva";

function sugerenciaBase(tipo: SugerenciaData["tipo"]): SugerenciaData {
    return {
        tipo,
        titulo: "Título de prueba",
        mensaje: "Mensaje de prueba",
        accion: { etiqueta: "Acción", href: "/dashboard/padre/circulo-confianza" },
        metadata: {
            contactosVerde: 0,
            contactosAmbar: 0,
            contactosRojo: 0,
            expedientesAmbar: 0,
            expedientesRojo: 0,
            diasDesdeUltimaNovedad: null,
        },
    };
}

describe("SugerenciaProactivaCard (SPEC-307)", () => {
    it("renderiza tipo INVITAR_CONTACTOS", () => {
        render(<SugerenciaProactivaCard sugerencia={sugerenciaBase("INVITAR_CONTACTOS")} />);
        expect(screen.getByText("Título de prueba")).toBeDefined();
        expect(screen.getByText("Mensaje de prueba")).toBeDefined();
        expect(screen.getByText("Acción")).toBeDefined();
    });

    it("renderiza tipo ROJO con enlace", () => {
        const sugerencia = sugerenciaBase("ROJO");
        sugerencia.accion = { etiqueta: "Ver expedientes", href: "/dashboard/padre/expedientes" };
        render(<SugerenciaProactivaCard sugerencia={sugerencia} />);

        const link = screen.getByRole("link", { name: /ver expedientes/i });
        expect(link.getAttribute("href")).toBe("/dashboard/padre/expedientes");
    });

    it("renderiza tipo TODO_VERDE", () => {
        render(<SugerenciaProactivaCard sugerencia={sugerenciaBase("TODO_VERDE")} />);
        expect(screen.getByText("Título de prueba")).toBeDefined();
    });
});
