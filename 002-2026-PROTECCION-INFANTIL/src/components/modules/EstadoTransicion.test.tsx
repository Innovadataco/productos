import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstadoTransicion } from "./EstadoTransicion";

describe("EstadoTransicion (spec 091-US3)", () => {
    it("En proceso: muestra el spinner", () => {
        render(<EstadoTransicion enProceso={true} />);
        expect(screen.getByTestId("et-spinner")).toBeTruthy();
        expect(screen.queryByTestId("et-check")).toBeNull();
    });

    it("Procesado: flechas + check verde, animación de una sola corrida", () => {
        const { container } = render(<EstadoTransicion enProceso={false} />);
        expect(screen.getByTestId("et-arrow-0")).toBeTruthy();
        expect(screen.getByTestId("et-arrow-2")).toBeTruthy();
        expect(screen.getByTestId("et-check")).toBeTruthy();

        // La animación corre UNA vez (iteration-count: 1), nunca en bucle
        const estilos = container.querySelector("style")?.textContent ?? "";
        const ocurrencias = (estilos.match(/ 1 forwards/g) ?? []).length;
        expect(ocurrencias).toBeGreaterThanOrEqual(3);
        expect(estilos).not.toContain("infinite");
    });
});
