/**
 * SPEC-157 (O-2 del REVISO, cerrado en SPEC-145): test propio de LuzAmbiental.
 * Patrón de PanelVidrio.test.tsx: render por estado, token/clase aplicada,
 * aria-hidden (decorativo) y reduced-motion (estático por construcción).
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LuzAmbiental } from "./LuzAmbiental";

describe("LuzAmbiental (O-2)", () => {
    it("es decorativa: aria-hidden siempre, en los tres estados", () => {
        for (const estado of ["pino", "ambar", "rubi"] as const) {
            const { container } = render(<LuzAmbiental estado={estado} />);
            expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
        }
    });

    it("aplica el token de color de cada estado (pino/ámbar/rubí), nunca color crudo", () => {
        const casos = [
            ["pino", "--pino-rgb"],
            ["ambar", "--ambar-rgb"],
            ["rubi", "--rubi-rgb"],
        ] as const;
        for (const [estado, token] of casos) {
            const { container } = render(<LuzAmbiental estado={estado} />);
            const luz = container.firstElementChild as HTMLElement;
            expect(luz.style.background).toContain(`var(${token})`);
            // Sin colores crudos: todo color sale de un token CSS.
            expect(luz.style.background).not.toMatch(/#[0-9a-fA-F]{3,8}/);
            expect(luz.style.background).toContain("var(--papel-rgb)");
        }
    });

    it("expone el estado como data attribute", () => {
        const { container } = render(<LuzAmbiental estado="rubi" />);
        expect(container.firstElementChild?.getAttribute("data-estado")).toBe("rubi");
    });

    it("se queda detrás del vidrio y no captura layout propio", () => {
        const { container } = render(<LuzAmbiental estado="pino" />);
        const clase = container.firstElementChild?.getAttribute("class") ?? "";
        expect(clase).toContain("absolute");
        expect(clase).toContain("inset-0");
        expect(clase).toContain("-z-10");
    });

    it("reduced-motion: es estática por construcción (sin animación ni transición)", () => {
        const { container } = render(<LuzAmbiental estado="ambar" />);
        const luz = container.firstElementChild as HTMLElement;
        // Nada que animar: ni clases de animación/transición ni estilos inline de movimiento.
        expect(luz.getAttribute("class")).not.toMatch(/animate-|transition/);
        expect(luz.style.animation).toBe("");
        expect(luz.style.transition).toBe("");
    });

    it("acepta className adicional sin perder el posicionamiento", () => {
        const { container } = render(<LuzAmbiental estado="pino" className="opacity-80" />);
        const clase = container.firstElementChild?.getAttribute("class") ?? "";
        expect(clase).toContain("opacity-80");
        expect(clase).toContain("absolute");
    });
});
