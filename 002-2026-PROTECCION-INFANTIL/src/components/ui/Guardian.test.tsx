/**
 * SPEC-334 · El Guardián — el símbolo de marca. Verifica las reglas duras de §7:
 * el hueco del niño SIEMPRE está, las tallas simplifican (§4), y el ámbar es el
 * único color de alerta (§3, nada de rojo).
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Guardian } from "./Guardian";

describe("Guardian (SPEC-334)", () => {
    it("es una imagen accesible con el nombre del producto", () => {
        const { getByRole } = render(<Guardian />);
        const svg = getByRole("img");
        expect(svg.getAttribute("aria-label")).toBe("Protección Infantil");
    });

    it("§7: el hueco del niño (máscara) SIEMPRE está, en toda talla", () => {
        for (const variante of ["viva", "reducida", "minima"] as const) {
            const { container } = render(<Guardian variante={variante} />);
            // círculo (cabeza) + path (cuerpo) dentro de la máscara del hueco
            expect(container.querySelector("mask circle")).toBeTruthy();
            expect(container.querySelector("mask path")).toBeTruthy();
        }
    });

    it("§4: las tallas simplifican los nodos (viva 8 · reducida 4 · mínima 0)", () => {
        const cuenta = (variante: "viva" | "reducida" | "minima") =>
            render(<Guardian variante={variante} />).container.querySelectorAll("circle.pi-nd").length;
        expect(cuenta("viva")).toBe(8);
        expect(cuenta("reducida")).toBe(4);
        expect(cuenta("minima")).toBe(0);
    });

    it("§3: en alerta un nodo va en ámbar; jamás rojo", () => {
        const { container } = render(<Guardian estado="alerta" />);
        const html = container.innerHTML;
        expect(html).toContain("var(--ambar-rgb)");
        expect(html.toLowerCase()).not.toContain("red");
        expect(html).not.toMatch(/#(f00|ff0000|e11|dc2626|ef4444)/i);
    });

    it("dos instancias no colisionan ids de máscara/clip", () => {
        const { container } = render(
            <>
                <Guardian />
                <Guardian />
            </>
        );
        const ids = Array.from(container.querySelectorAll("mask")).map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
