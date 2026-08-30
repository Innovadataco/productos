/**
 * SPEC-309 (A-50): tests unitarios de TimelineResumen.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimelineResumen } from "./TimelineResumen";

describe("TimelineResumen", () => {
    it("muestra estado vacío cuando no hay eventos", () => {
        render(<TimelineResumen eventos={[]} />);
        expect(screen.getByText(/No hay eventos registrados/i)).toBeTruthy();
    });

    it("renderiza eventos con fecha, texto y categoría", () => {
        render(
            <TimelineResumen
                eventos={[
                    {
                        id: "e1",
                        fechaEvento: new Date("2026-08-20T10:00:00Z"),
                        texto: "Evento de prueba",
                        categoria: "CONTACTO_INSISTENTE",
                        contactoEtiqueta: "Hijo",
                        expedienteId: "exp1",
                    },
                ]}
            />
        );
        expect(screen.getByText("Evento de prueba")).toBeTruthy();
        expect(screen.getByText("CONTACTO_INSISTENTE")).toBeTruthy();
        expect(screen.getByText(/Hijo/i)).toBeTruthy();
    });
});
