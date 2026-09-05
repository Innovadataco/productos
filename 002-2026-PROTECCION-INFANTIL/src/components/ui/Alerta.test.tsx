import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alerta } from "./Alerta";

describe("Alerta", () => {
    it("renderiza el mensaje con role alert por defecto", () => {
        render(<Alerta tono="error">No se pudo guardar.</Alerta>);
        const alerta = screen.getByRole("alert");
        expect(alerta.textContent).toBe("No se pudo guardar.");
    });

    // SPEC-458: el candado se mueve con el arreglo — antes exigía `bg-red-50`
    // (color crudo); ahora exige el token por función. Color por FUNCIÓN.
    it("aplica el token de cada tono (0 colores crudos)", () => {
        const { rerender } = render(<Alerta tono="error">e</Alerta>);
        expect(screen.getByRole("alert").className).toContain("bg-rubi/10");
        expect(screen.getByRole("alert").className).toContain("text-estado-rubi");
        rerender(<Alerta tono="exito">e</Alerta>);
        expect(screen.getByRole("alert").className).toContain("bg-pino/10");
        expect(screen.getByRole("alert").className).toContain("text-estado-pino");
        rerender(<Alerta tono="advertencia">e</Alerta>);
        expect(screen.getByRole("alert").className).toContain("bg-ambar/10");
        expect(screen.getByRole("alert").className).toContain("text-estado-ambar");
        rerender(<Alerta tono="info">e</Alerta>);
        expect(screen.getByRole("alert").className).toContain("bg-cielo/10");
        expect(screen.getByRole("alert").className).toContain("text-estado-cielo");
    });

    // Contraprueba en las dos direcciones (candado del radicado):
    it("el rojo (rubi) es SOLO para error, nunca para info/éxito/atención", () => {
        const { rerender } = render(<Alerta tono="error">e</Alerta>);
        expect(screen.getByRole("alert").className).toMatch(/rubi/);
        for (const tono of ["exito", "advertencia", "info"] as const) {
            rerender(<Alerta tono={tono}>e</Alerta>);
            expect(screen.getByRole("alert").className, `${tono} no debe usar rubi`).not.toMatch(/rubi/);
        }
    });

    it("ningún tono deja color crudo de Tailwind (red-/emerald-/amber-/sky-)", () => {
        for (const tono of ["error", "exito", "advertencia", "info"] as const) {
            const { unmount } = render(<Alerta tono={tono}>e</Alerta>);
            expect(screen.getByRole("alert").className).not.toMatch(/\b(bg|text)-(red|emerald|amber|sky)-\d/);
            unmount();
        }
    });

    it("muestra un icono por defecto y lo oculta con sinIcono", () => {
        const { container, rerender } = render(<Alerta tono="info">e</Alerta>);
        expect(container.querySelector("svg")).not.toBeNull();
        rerender(
            <Alerta tono="info" sinIcono>
                e
            </Alerta>
        );
        expect(container.querySelector("svg")).toBeNull();
    });

    it("permite role status para mensajes no críticos", () => {
        render(
            <Alerta tono="exito" role="status">
                Guardado.
            </Alerta>
        );
        expect(screen.getByRole("status").textContent).toBe("Guardado.");
    });
});
