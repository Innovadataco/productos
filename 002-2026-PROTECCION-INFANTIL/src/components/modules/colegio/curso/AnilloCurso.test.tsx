/**
 * SPEC-147 (T005, SC-003) — AnilloCurso: dibuja el anillo mini 88px con los
 * porcentajes del fixture (70%/50%) y con 0 estudiantes no rompe (sin NaN).
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnilloCurso } from "./AnilloCurso";

describe("AnilloCurso", () => {
    it("dibuja el anillo 88px con aria-label completo y el texto corto", () => {
        const { container } = render(
            <AnilloCurso vigilancia={0.7} reaccion={0.5} estudiantes={10} sinRedes={3} sinContacto={5} />
        );
        const svg = container.querySelector("svg");
        expect(svg?.getAttribute("width")).toBe("88");
        expect(svg?.getAttribute("aria-label")).toContain("vigilancia 70%");
        expect(svg?.getAttribute("aria-label")).toContain("reacción 50%");
        expect(screen.getByText("70%")).toBeTruthy();
        expect(screen.getByText("50%")).toBeTruthy();
        expect(screen.getByText(/con redes/)).toBeTruthy();
        expect(screen.getByText(/con acudiente/)).toBeTruthy();
    });

    it("con 0 estudiantes no rompe: 0% y sin NaN", () => {
        render(<AnilloCurso vigilancia={0} reaccion={0} estudiantes={0} sinRedes={0} sinContacto={0} />);
        const ceros = screen.getAllByText("0%");
        expect(ceros).toHaveLength(2);
        expect(screen.queryByText(/NaN/)).toBeNull();
    });
});
