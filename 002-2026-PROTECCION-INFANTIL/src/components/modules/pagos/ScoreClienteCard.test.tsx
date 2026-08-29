/**
 * SPEC-220 (002-PI-121): tests unitarios de render de la card "Score de valor".
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreClienteCard } from "./ScoreClienteCard";
import type { ScoreClienteVista } from "@/lib/dal/repositories/analisis-repository";

function vista(parcial: Partial<ScoreClienteVista> = {}): ScoreClienteVista {
    return {
        periodo: "2026-08",
        scoreTotal: 16,
        componentes: { reportes: 2, casos: 1, alertas: 1, sesiones: 3 },
        pesos: { reportes: 3, casos: 5, alertas: 2, sesiones: 1 },
        percentilEnCohorte: 50,
        calculadoEn: new Date("2026-08-15T10:00:00Z"),
        ...parcial,
    };
}

describe("ScoreClienteCard", () => {
    it("muestra total, desglose por componente con peso aplicado y percentil", () => {
        render(<ScoreClienteCard actual={vista()} historico={[vista()]} />);

        expect(screen.getByText("Score de valor este mes")).toBeTruthy();
        // El total aparece en el encabezado y también en la lista de histórico.
        expect(screen.getAllByText("16").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Período 2026-08")).toBeTruthy();
        expect(screen.getByText("Percentil en su cohorte: 50")).toBeTruthy();
        expect(screen.getByText("2 × 3 = 6")).toBeTruthy(); // Reportes
        expect(screen.getByText("1 × 5 = 5")).toBeTruthy(); // Casos
        expect(screen.getByText("1 × 2 = 2")).toBeTruthy(); // Alertas
        expect(screen.getByText("3 × 1 = 3")).toBeTruthy(); // Sesiones
        expect(screen.getByText("Reportes")).toBeTruthy();
        expect(screen.getByText("Casos")).toBeTruthy();
        expect(screen.getByText("Alertas")).toBeTruthy();
        expect(screen.getByText("Sesiones")).toBeTruthy();
    });

    it("muestra el estado vacío neutral cuando no hay score calculado", () => {
        render(<ScoreClienteCard actual={null} historico={[]} />);

        expect(screen.getByText("Score de valor aún no calculado para este período.")).toBeTruthy();
        expect(screen.queryByText("Percentil en su cohorte: 50")).toBeNull();
    });

    it("no muestra percentil cuando la cohorte es unitaria (null)", () => {
        render(<ScoreClienteCard actual={vista({ percentilEnCohorte: null })} historico={[]} />);

        expect(screen.getByText("16")).toBeTruthy();
        expect(screen.queryByText(/Percentil en su cohorte/)).toBeNull();
    });

    it("lista el histórico ordenado con período y scoreTotal", () => {
        const historico = [
            vista({ periodo: "2026-08", scoreTotal: 16 }),
            vista({ periodo: "2026-07", scoreTotal: 9 }),
        ];
        render(<ScoreClienteCard actual={historico[0]!} historico={historico} />);

        expect(screen.getByText("Histórico (últimos 12 meses)")).toBeTruthy();
        expect(screen.getByText("2026-07")).toBeTruthy();
        expect(screen.getByText("9")).toBeTruthy();
    });

    it("sin score pero con histórico muestra estado vacío y la lista de meses", () => {
        render(<ScoreClienteCard actual={null} historico={[vista({ periodo: "2026-07", scoreTotal: 9 })]} />);

        expect(screen.getByText("Score de valor aún no calculado para este período.")).toBeTruthy();
        expect(screen.getByText("2026-07")).toBeTruthy();
    });
});
