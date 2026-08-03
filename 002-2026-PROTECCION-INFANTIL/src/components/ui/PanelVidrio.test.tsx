import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LuzAmbiental } from "./LuzAmbiental";
import { PanelVidrio } from "./PanelVidrio";

describe("LuzAmbiental", () => {
    it("renderiza el campo de luz oculto para lectores de pantalla", () => {
        const { container } = render(<LuzAmbiental estado="pino" />);
        const luz = container.firstElementChild;
        expect(luz?.getAttribute("aria-hidden")).toBe("true");
    });

    it("cambia de color con el estado, siempre por token", () => {
        const { container, rerender } = render(<LuzAmbiental estado="pino" />);
        const luz = container.firstElementChild as HTMLElement;
        expect(luz.style.background).toContain("var(--pino-rgb)");

        rerender(<LuzAmbiental estado="ambar" />);
        expect(luz.style.background).toContain("var(--ambar-rgb)");

        rerender(<LuzAmbiental estado="rubi" />);
        expect(luz.style.background).toContain("var(--rubi-rgb)");
    });

    it("expone el estado como data attribute para depuración y tests", () => {
        const { container } = render(<LuzAmbiental estado="ambar" />);
        expect(container.firstElementChild?.getAttribute("data-estado")).toBe("ambar");
    });
});

describe("PanelVidrio", () => {
    it("renderiza un panel glass con sus hijos", () => {
        render(<PanelVidrio>Contenido</PanelVidrio>);
        const panel = screen.getByText("Contenido");
        expect(panel.getAttribute("class")).toContain("glass");
    });

    it("tone strong usa glass-strong", () => {
        render(<PanelVidrio tone="strong">Contenido</PanelVidrio>);
        expect(screen.getByText("Contenido").getAttribute("class")).toContain("glass-strong");
    });

    it("sin estado no compone LuzAmbiental", () => {
        const { container } = render(<PanelVidrio>Contenido</PanelVidrio>);
        expect(container.querySelector("[data-estado]")).toBeNull();
    });

    it("con estado compone el campo de luz ambiental detrás del vidrio", () => {
        const { container } = render(<PanelVidrio estado="rubi">Contenido</PanelVidrio>);
        const luz = container.querySelector('[data-estado="rubi"]');
        expect(luz).toBeTruthy();
        expect(screen.getByText("Contenido")).toBeTruthy();
    });

    it("acepta className adicional sin perder el vidrio", () => {
        render(<PanelVidrio className="p-6">Contenido</PanelVidrio>);
        const panel = screen.getByText("Contenido");
        expect(panel.getAttribute("class")).toContain("glass");
        expect(panel.getAttribute("class")).toContain("p-6");
    });
});
