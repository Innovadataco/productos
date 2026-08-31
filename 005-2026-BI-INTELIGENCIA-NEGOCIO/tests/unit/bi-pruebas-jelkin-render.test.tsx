import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TablaPruebasJelkin } from "@/components/bi/operacion/TablaPruebasJelkin";
import type { PruebasJelkin } from "@/lib/bi/operacion";

const p: PruebasJelkin = {
    resumen: "2 pruebas · 18 hallazgos",
    filas: [
        { id: "J-01", prueba: "Ciclo completo de colegio", fecha: "30-08-2026 14:00", hallazgos: "16 · → A-53, I-33", estado: "Cumple" },
        { id: "J-02", prueba: "Rol padre", fecha: "30-08-2026 16:30", hallazgos: "2 rojos · → I-33", estado: "Parcial" },
    ],
};

describe("TablaPruebasJelkin", () => {
    it("renderiza J-01/J-02 en el orden del array", () => {
        render(<TablaPruebasJelkin p={p} />);
        const ids = screen.getAllByText(/^J-\d+$/).map((n) => n.textContent);
        expect(ids).toEqual(["J-01", "J-02"]);
    });

    it("muestra prueba, hallazgos y resumen verbatim", () => {
        render(<TablaPruebasJelkin p={p} />);
        expect(screen.getByText("Ciclo completo de colegio")).toBeTruthy();
        expect(screen.getByText("16 · → A-53, I-33")).toBeTruthy();
        expect(screen.getByText("2 pruebas · 18 hallazgos")).toBeTruthy();
        expect(screen.getByText("Pruebas de Jelkin")).toBeTruthy();
    });

    it("array ausente (undefined) → NO pinta (retorna null)", () => {
        const { container } = render(<TablaPruebasJelkin p={undefined} />);
        expect(container.innerHTML).toBe("");
    });

    it("null → NO pinta", () => {
        const { container } = render(<TablaPruebasJelkin p={null} />);
        expect(container.innerHTML).toBe("");
    });

    it("filas vacío → NO pinta", () => {
        const { container } = render(<TablaPruebasJelkin p={{ filas: [] }} />);
        expect(container.innerHTML).toBe("");
    });

    it("estado Cumple → tag ok · Parcial → tag mid", () => {
        render(<TablaPruebasJelkin p={p} />);
        const cumple = screen.getByText("Cumple");
        expect(cumple.className).toContain("tag");
        expect(cumple.className).toContain("ok");
        const parcial = screen.getByText("Parcial");
        expect(parcial.className).toContain("mid");
    });

    it("estado Bloqueado → tag bad · desconocido → neutro texto crudo · null → dash", () => {
        const p2: PruebasJelkin = {
            filas: [
                { id: "J-03", prueba: "a", estado: "Bloqueado" },
                { id: "J-04", prueba: "b", estado: "Congelado" },
                { id: "J-05", prueba: "c", estado: null },
            ],
        };
        render(<TablaPruebasJelkin p={p2} />);
        expect(screen.getByText("Bloqueado").className).toContain("bad");
        const crudo = screen.getByText("Congelado");
        expect(crudo.className).toContain("neutro");
        // J-05 estado null → guion (hay al menos un dash en la tabla)
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });

    it("fecha null → dash", () => {
        const p3: PruebasJelkin = {
            filas: [{ id: "J-09", prueba: "sin fecha", fecha: null, hallazgos: "x", estado: "Cumple" }],
        };
        render(<TablaPruebasJelkin p={p3} />);
        expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });
});
