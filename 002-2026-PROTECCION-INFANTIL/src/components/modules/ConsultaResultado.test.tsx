import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsultaResultado } from "./ConsultaResultado";

vi.mock("./ScoreDisplay", () => ({
    ScoreDisplay: () => <div data-testid="score-display" />,
}));

describe("ConsultaResultado", () => {
    it("usa el campo `total` de la API en los badges de plataforma (sin 'undefined')", () => {
        render(
            <ConsultaResultado
                data={{
                    identificador: "3001111111",
                    tieneReportes: true,
                    totalReportes: 3,
                    plataformas: [
                        { id: "p1", nombre: "Facebook", clave: "facebook", total: 2, otraPlataforma: null },
                        { id: "p2", nombre: "WhatsApp", clave: "whatsapp", total: 1, otraPlataforma: null },
                    ],
                }}
            />
        );

        expect(screen.getByTitle("2 reportes")).toBeTruthy();
        expect(screen.getByTitle("1 reportes")).toBeTruthy();
        expect(document.body.textContent).not.toContain("undefined");
    });

    it("muestra el mensaje cuando no hay reportes", () => {
        render(
            <ConsultaResultado
                data={{
                    identificador: "3000000000",
                    tieneReportes: false,
                    mensaje: "Sin reportes registrados para este identificador.",
                }}
            />
        );

        expect(document.body.textContent).toContain("Sin reportes registrados para este identificador.");
    });
});
