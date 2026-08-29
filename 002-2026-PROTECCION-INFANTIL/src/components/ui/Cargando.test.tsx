import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Cargando } from "./Cargando";

describe("Cargando", () => {
    it("muestra el texto por defecto con role status", () => {
        render(<Cargando />);
        const status = screen.getByRole("status");
        expect(status.textContent).toContain("Cargando...");
    });

    it("muestra texto personalizado", () => {
        render(<Cargando texto="Cargando reportes..." />);
        expect(screen.getByRole("status").textContent).toContain("Cargando reportes...");
    });

    it("forma inline renderiza en línea con el spinner oculto a lectores", () => {
        const { container } = render(<Cargando inline texto="Cargando cuentas..." />);
        const status = screen.getByRole("status");
        expect(status.tagName).toBe("SPAN");
        expect(status.textContent).toContain("Cargando cuentas...");
        expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
    });

    it("permite ocultar el texto (spinner solo)", () => {
        render(<Cargando texto="" />);
        const status = screen.getByRole("status");
        expect(status.querySelector("p")).toBeNull();
    });
});
