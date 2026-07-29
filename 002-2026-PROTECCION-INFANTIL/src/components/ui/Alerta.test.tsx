import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alerta } from "./Alerta";

describe("Alerta", () => {
    it("renderiza el mensaje con role alert por defecto", () => {
        render(<Alerta tono="error">No se pudo guardar.</Alerta>);
        const alerta = screen.getByRole("alert");
        expect(alerta.textContent).toBe("No se pudo guardar.");
    });

    it("aplica las clases de cada tono", () => {
        const { rerender } = render(<Alerta tono="error">e</Alerta>);
        expect(screen.getByRole("alert").className).toContain("bg-red-50");
        rerender(<Alerta tono="exito">e</Alerta>);
        expect(screen.getByRole("alert").className).toContain("bg-emerald-50");
        rerender(<Alerta tono="advertencia">e</Alerta>);
        expect(screen.getByRole("alert").className).toContain("bg-amber-50");
        rerender(<Alerta tono="info">e</Alerta>);
        expect(screen.getByRole("alert").className).toContain("bg-sky-50");
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
