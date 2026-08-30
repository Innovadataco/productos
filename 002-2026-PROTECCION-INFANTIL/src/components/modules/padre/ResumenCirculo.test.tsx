/**
 * SPEC-309 (A-50): tests unitarios de ResumenCirculo.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResumenCirculo } from "./ResumenCirculo";

describe("ResumenCirculo", () => {
    it("muestra estado vacío cuando no hay contactos", () => {
        render(<ResumenCirculo resumen={{ totalContactos: 0, sinReportes: 0, enRevision: 0, clasificados: 0 }} />);
        expect(screen.getByText(/Aún no tienes contactos/i)).toBeTruthy();
    });

    it("renderiza los conteos del círculo", () => {
        render(<ResumenCirculo resumen={{ totalContactos: 5, sinReportes: 2, enRevision: 1, clasificados: 3 }} />);
        expect(screen.getByText("5")).toBeTruthy();
        expect(screen.getByText("Sin reportes")).toBeTruthy();
        expect(screen.getByText("En revisión")).toBeTruthy();
        expect(screen.getByText("Clasificados")).toBeTruthy();
    });
});
