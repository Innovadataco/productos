import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstadoTransicion } from "./EstadoTransicion";

describe("EstadoTransicion (spec 091-C)", () => {
    it("ambos extremos siempre renderizados (En proceso y Procesado)", () => {
        render(<EstadoTransicion enProceso={true} />);
        expect(screen.getByTestId("et-extremo-proceso")).toBeTruthy();
        expect(screen.getByTestId("et-extremo-procesado")).toBeTruthy();
        expect(screen.getByTestId("et-track")).toBeTruthy();
    });

    it("En proceso: la píldora pulsa en el extremo izquierdo (sin viaje)", () => {
        const { container } = render(<EstadoTransicion enProceso={true} />);
        const pill = screen.getByTestId("et-pill");
        expect(pill.className).toContain("et-pill-pulse");
        expect(pill.className).not.toContain("et-pill-travel");
        expect(screen.queryByTestId("et-check")).toBeNull();
        const estilos = container.querySelector("style")?.textContent ?? "";
        expect(estilos).toContain("et-pulse");
    });

    it("Procesado: la píldora VIAJA (translateX, gris→verde) y llega el check", () => {
        const { container } = render(<EstadoTransicion enProceso={false} />);
        const pill = screen.getByTestId("et-pill");
        expect(pill.className).toContain("et-pill-travel");

        const estilos = container.querySelector("style")?.textContent ?? "";
        // El objeto cambia de posición en el tiempo: keyframes con translateX
        expect(estilos).toContain("translateX(120px)");
        // Cambio gris → verde durante el viaje
        expect(estilos).toContain("rgb(148, 163, 184)");
        expect(estilos).toContain("rgb(34, 197, 94)");
        // Arranca tras ~400ms, corre UNA vez
        expect(estilos).toContain("0.4s 1 forwards");
        expect(estilos).not.toContain("et-travel 1s ease-in-out 0.4s infinite");
        // Al llegar: check presente
        expect(screen.getByTestId("et-check")).toBeTruthy();
    });
});
