/**
 * SPEC-660 · Candado del bloque de hueco de cobertura.
 *  - CIELO, nunca ámbar ni rojo (un por-hacer, no una alarma; un color = un significado).
 *  - Nombra al hijo (no un genérico).
 *  - No promete «te avisamos» (I-397).
 *  - Vacío → no renderiza nada.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BloqueHuecoCobertura } from "./BloqueHuecoCobertura";

describe("SPEC-660 · bloque de hueco de cobertura (render)", () => {
    it("CIELO, nunca ámbar ni rojo", () => {
        const { container } = render(<BloqueHuecoCobertura hijos={[{ id: "1", nombre: "Mateo Restrepo" }]} />);
        expect(container.innerHTML).toMatch(/cielo/);
        expect(container.innerHTML).not.toMatch(/ambar|--ambar|rubi|\brojo\b|\bred\b/i);
    });

    it("nombra al hijo y no promete «te avisamos»", () => {
        const t = render(<BloqueHuecoCobertura hijos={[{ id: "1", nombre: "Mateo Restrepo" }]} />).container.textContent ?? "";
        expect(t).toContain("Mateo");
        expect(t).not.toMatch(/te avisamos|te avisaremos/i);
        expect(t).toContain("Agregar una cuenta");
    });

    it("sin huecos → no renderiza nada", () => {
        const { container } = render(<BloqueHuecoCobertura hijos={[]} />);
        expect(container.innerHTML).toBe("");
    });
});
