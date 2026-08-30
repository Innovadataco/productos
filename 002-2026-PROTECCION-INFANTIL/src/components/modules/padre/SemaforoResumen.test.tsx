/**
 * SPEC-309 (A-50): tests unitarios de SemaforoResumen.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SemaforoResumen } from "./SemaforoResumen";

describe("SemaforoResumen", () => {
    it("muestra estado vacío cuando no hay contactos", () => {
        render(<SemaforoResumen contactos={[]} />);
        expect(screen.getByText(/Agrega contactos para ver su nivel de atención/i)).toBeTruthy();
    });

    it("renderiza contactos con color y total de reportes", () => {
        render(
            <SemaforoResumen
                contactos={[
                    { id: "c1", etiqueta: "Hijo", color: "ROJO", totalReportes: 3 },
                    { id: "c2", etiqueta: "Sobrina", color: "VERDE", totalReportes: 0 },
                ]}
            />
        );
        const itemHijo = screen.getByText("Hijo").closest("li");
        expect(itemHijo).toBeTruthy();
        expect(itemHijo?.textContent).toContain("3 reportes");
        expect(screen.getByText("Sobrina")).toBeTruthy();
    });
});
