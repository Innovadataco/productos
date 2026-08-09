/**
 * SPEC-147 (T005) — TarjetasCurso: "Reportes 30d" con delta (baja/sube/sin
 * cambio vs mes previo) e "Identificadores" con cobertura en %.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TarjetasCurso, textoDelta } from "./TarjetasCurso";

describe("TarjetasCurso", () => {
    it("muestra reportes 30d con delta a la baja e identificadores con cobertura", () => {
        render(<TarjetasCurso alertas30d={2} delta30d={-1} identificadoresActivos={54} coberturaPct={89} />);
        expect(screen.getByText("Reportes 30d")).toBeTruthy();
        expect(screen.getByText("2")).toBeTruthy();
        expect(screen.getByText("↓ 1 vs mes previo")).toBeTruthy();
        expect(screen.getByText("Identificadores")).toBeTruthy();
        expect(screen.getByText("54")).toBeTruthy();
        expect(screen.getByText("Cobertura 89%")).toBeTruthy();
    });

    it("delta al alza y sin cambio", () => {
        const { rerender } = render(
            <TarjetasCurso alertas30d={4} delta30d={2} identificadoresActivos={10} coberturaPct={50} />
        );
        expect(screen.getByText("↑ 2 vs mes previo")).toBeTruthy();
        rerender(<TarjetasCurso alertas30d={4} delta30d={0} identificadoresActivos={10} coberturaPct={50} />);
        expect(screen.getByText("sin cambio vs mes previo")).toBeTruthy();
    });

    it("textoDelta: signo y valor absoluto", () => {
        expect(textoDelta(3)).toBe("↑ 3 vs mes previo");
        expect(textoDelta(-2)).toBe("↓ 2 vs mes previo");
        expect(textoDelta(0)).toBe("sin cambio vs mes previo");
    });
});
