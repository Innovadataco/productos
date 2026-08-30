import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { EquiposChips } from "@/components/bi/operacion/EquiposChips";
import { TablaRecorridos } from "@/components/bi/operacion/TablaRecorridos";
import { AvisoSinDatos } from "@/components/bi/operacion/AvisoSinDatos";
import type { Equipo, Recorridos } from "@/lib/bi/operacion";

describe("TablaRecorridos", () => {
    const r: Recorridos = {
        resumen: "test",
        filas: [
            { id: "R-05", nombre: "quinto", avance: { hechos: 1, total: 2 } },
            { id: "R-01", nombre: "primero", avance: { hechos: 10, total: 10 } },
            {
                id: "R-13",
                nombre: "critico",
                avance: { hechos: 0, total: 1 },
                teNecesita: { necesita: true, pasos: "hacé algo", critico: true },
            },
        ],
    };

    it("respeta el orden del array (NO reordena por id)", () => {
        render(<TablaRecorridos r={r} />);
        const ids = screen.getAllByText(/^R-\d+$/).map((n) => n.textContent);
        expect(ids).toEqual(["R-05", "R-01", "R-13"]);
    });

    it("teNecesita critico → clase need hard", () => {
        render(<TablaRecorridos r={r} />);
        const cell = screen.getByText(/Sí · hacé algo/);
        expect(cell.className).toContain("need");
        expect(cell.className).toContain("hard");
    });

    it("teNecesita ausente → 'No' tenue", () => {
        render(<TablaRecorridos r={r} />);
        const noes = screen.getAllByText("No");
        expect(noes.length).toBeGreaterThan(0);
        expect(noes[0].className).toContain("dash");
    });

    it("avance total 0 → barra 0% sin romper", () => {
        const r0: Recorridos = {
            filas: [{ id: "R-X", nombre: "x", avance: { hechos: 3, total: 0 } }],
        };
        render(<TablaRecorridos r={r0} />);
        expect(screen.getByText("3/0")).toBeTruthy();
    });
});

describe("EquiposChips", () => {
    it("estado desconocido → clase off + texto crudo del estado", () => {
        const equipos: Equipo[] = [
            {
                equipo: "Test",
                personas: [{ nombre: "X", estado: "congelado", nota: "ignorada" }],
            },
        ];
        render(<EquiposChips equipos={equipos} />);
        const chip = screen.getByText("X").closest(".who");
        expect(chip?.className).toContain("off");
        // muestra el estado crudo, no la nota, cuando es desconocido
        expect(within(chip as HTMLElement).queryByText("congelado")).toBeTruthy();
    });

    it("estado conocido con nota → muestra la nota", () => {
        const equipos: Equipo[] = [
            {
                equipo: "Test",
                personas: [{ nombre: "Y", estado: "ocupado", nota: "en A-55" }],
            },
        ];
        render(<EquiposChips equipos={equipos} />);
        const chip = screen.getByText("Y").closest(".who");
        expect(chip?.className).toContain("ocupado");
        expect(within(chip as HTMLElement).queryByText("en A-55")).toBeTruthy();
    });
});

describe("AvisoSinDatos", () => {
    it("motivo ausente e invalido dan mensajes distintos, nunca vacíos", () => {
        const { rerender } = render(<AvisoSinDatos motivo="ausente" />);
        const a = screen.getByTestId("aviso-sin-datos").textContent ?? "";
        expect(a.length).toBeGreaterThan(10);
        expect(a).toContain("no se pudo leer");

        rerender(<AvisoSinDatos motivo="invalido" />);
        const b = screen.getByTestId("aviso-sin-datos").textContent ?? "";
        expect(b).toContain("JSON inválido");
        expect(a).not.toBe(b);
    });
});
