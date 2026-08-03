import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Declaracion } from "./Declaracion";

describe("Declaracion", () => {
    it("renderiza el titular con la escala de titular de estado (serif)", () => {
        render(<Declaracion estado="pino" palabra="tranquilos" titular="Todo en tu colegio está {palabra}." />);
        const titular = screen.getByRole("heading", { level: 1 });
        expect(titular.getAttribute("class")).toContain("titular-estado");
        expect(titular.textContent).toBe("Todo en tu colegio está tranquilos.");
    });

    it("la palabra del estado va en cursiva serif y en el color del estado (token)", () => {
        render(<Declaracion estado="ambar" palabra="algo" titular="Hay {palabra} que mirar." />);
        const palabra = screen.getByText("algo");
        expect(palabra.getAttribute("class")).toContain("palabra-estado");
        expect(palabra.getAttribute("class")).toContain("text-estado-ambar");
    });

    it("cada estado usa su token de tinta de estado", () => {
        const { rerender } = render(<Declaracion estado="pino" palabra="tranquilos" titular="Están {palabra}." />);
        expect(screen.getByText("tranquilos").getAttribute("class")).toContain("text-estado-pino");

        rerender(<Declaracion estado="rubi" palabra="hoy" titular="Actúa {palabra}." />);
        expect(screen.getByText("hoy").getAttribute("class")).toContain("text-estado-rubi");
    });

    it("si el titular no contiene el marcador, la palabra se añade al final", () => {
        render(<Declaracion estado="pino" palabra="tranquilos" titular="Todo en orden," />);
        const titular = screen.getByRole("heading", { level: 1 });
        expect(titular.textContent).toBe("Todo en orden, tranquilos");
    });
});
