import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
    it("renderiza título y descripción", () => {
        render(<EmptyState title="Sin resultados" description="Aún no hay datos." />);
        expect(screen.getByText("Sin resultados")).toBeTruthy();
        expect(screen.getByText("Aún no hay datos.")).toBeTruthy();
    });

    it("no muestra descripción si no se proporciona", () => {
        render(<EmptyState title="Vacío" />);
        expect(screen.getByText("Vacío")).toBeTruthy();
        expect(screen.queryByText("Aún no hay datos.")).toBeNull();
    });

    it("renderiza acción cuando se proporciona", () => {
        render(<EmptyState title="Sin elementos" action={<button type="button">Crear</button>} />);
        expect(screen.getByRole("button", { name: "Crear" })).toBeTruthy();
    });

    it("renderiza icono personalizado cuando se proporciona", () => {
        render(<EmptyState title="Con icono" icon={<span data-testid="custom-icon">★</span>} />);
        expect(screen.getByTestId("custom-icon")).toBeTruthy();
    });
});

