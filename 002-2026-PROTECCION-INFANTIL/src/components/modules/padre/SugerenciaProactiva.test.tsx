/**
 * SPEC-309 (A-50): tests unitarios de SugerenciaProactiva.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SugerenciaProactiva } from "./SugerenciaProactiva";

describe("SugerenciaProactiva", () => {
    it("renderiza texto y botón de acción", () => {
        render(
            <SugerenciaProactiva
                sugerencia={{
                    texto: "Revisa el expediente de tu hijo",
                    accionHref: "/dashboard/padre/expedientes",
                    accionTexto: "Ver expedientes",
                    prioridad: "alta",
                }}
            />
        );
        expect(screen.getByText(/Revisa el expediente/i)).toBeTruthy();
        const link = screen.getByRole("link", { name: /Ver expedientes/i });
        expect(link.getAttribute("href")).toBe("/dashboard/padre/expedientes");
    });

    it("no muestra botón si no hay acción", () => {
        render(<SugerenciaProactiva sugerencia={{ texto: "Todo tranquilo", accionHref: null, accionTexto: null, prioridad: "baja" }} />);
        expect(screen.queryByRole("link")).toBeNull();
    });
});
