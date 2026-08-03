import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Anillo } from "./Anillo";

const BASE = {
    vigilancia: 0.89,
    reaccion: 0.72,
    estudiantes: 347,
    sinRedes: 38,
    sinContacto: 97,
};

describe("Anillo", () => {
    it("renderiza un svg con role img y aria-label con ambos porcentajes", () => {
        render(<Anillo {...BASE} />);
        const img = screen.getByRole("img");
        const label = img.getAttribute("aria-label") ?? "";
        expect(label).toContain("89%");
        expect(label).toContain("72%");
        expect(label).toContain("38");
    });

    it("dibuja dos arcos concéntricos: exterior=vigilancia (cielo), interior=reacción (pino)", () => {
        const { container } = render(<Anillo {...BASE} />);
        const vigilancia = container.querySelector('[data-arco="vigilancia"]');
        const reaccion = container.querySelector('[data-arco="reaccion"]');
        expect(vigilancia).toBeTruthy();
        expect(reaccion).toBeTruthy();
        expect(vigilancia?.getAttribute("class")).toContain("stroke-cielo");
        expect(reaccion?.getAttribute("class")).toContain("stroke-pino");
        expect(vigilancia?.getAttribute("stroke-width")).toBe("17");
        expect(reaccion?.getAttribute("stroke-width")).toBe("17");
        expect(vigilancia?.getAttribute("stroke-linecap")).toBe("round");
        // anillo interior dentro del exterior
        const rExt = Number(vigilancia?.getAttribute("r"));
        const rInt = Number(reaccion?.getAttribute("r"));
        expect(rInt).toBeLessThan(rExt);
    });

    it("cada arco codifica su número real: dashoffset final = circunferencia × (1 - fracción)", () => {
        const { container } = render(<Anillo {...BASE} />);
        const vigilancia = container.querySelector('[data-arco="vigilancia"]');
        const r = Number(vigilancia?.getAttribute("r"));
        const circ = 2 * Math.PI * r;
        const esperado = circ * (1 - 0.89);
        const offset = Number(vigilancia?.getAttribute("stroke-dashoffset"));
        expect(offset).toBeCloseTo(esperado, 6);
    });

    it("muestra el centro con escudo y el número de estudiantes en cifra tabular", () => {
        const { container } = render(<Anillo {...BASE} />);
        expect(container.querySelector('[data-centro="escudo"]')).toBeTruthy();
        const cifra = screen.getByText("347");
        expect(cifra.getAttribute("class")).toContain("cifra");
    });

    it("la leyenda nombra el hueco en personas, no en porcentaje", () => {
        render(<Anillo {...BASE} />);
        expect(screen.getByText("38 estudiantes sin redes registradas")).toBeTruthy();
        expect(screen.getByText("97 estudiantes sin acudiente a quien llamar")).toBeTruthy();
    });

    it("usa singular cuando el hueco es de una persona", () => {
        render(<Anillo {...BASE} sinRedes={1} />);
        expect(screen.getByText("1 estudiante sin redes registradas")).toBeTruthy();
    });

    it("en escala mini (88px) no muestra leyenda ni centro", () => {
        const { container } = render(<Anillo {...BASE} size={88} />);
        expect(screen.queryByText(/sin redes registradas/)).toBeNull();
        expect(container.querySelector('[data-centro="escudo"]')).toBeNull();
        // los dos arcos siguen presentes
        expect(container.querySelector('[data-arco="vigilancia"]')).toBeTruthy();
        expect(container.querySelector('[data-arco="reaccion"]')).toBeTruthy();
    });

    it("se dibuja al entrar con la animación del sistema y la curva única", () => {
        const { container } = render(<Anillo {...BASE} />);
        const vigilancia = container.querySelector('[data-arco="vigilancia"]');
        expect(vigilancia?.getAttribute("class")).toContain("anim-dibujo");
    });

    it("con reduced-motion el arco muestra su valor real: el dashoffset base ES el final", () => {
        // La media query global apaga la animación; el estado sin animar debe ser
        // ya el valor final (no el inicial), para que el dato sea visible siempre.
        const { container } = render(<Anillo {...BASE} vigilancia={0.5} />);
        const vigilancia = container.querySelector('[data-arco="vigilancia"]');
        const r = Number(vigilancia?.getAttribute("r"));
        const circ = 2 * Math.PI * r;
        expect(Number(vigilancia?.getAttribute("stroke-dashoffset"))).toBeCloseTo(circ * 0.5, 6);
    });

    it("tiñe el escudo con el token del estado", () => {
        const { container } = render(<Anillo {...BASE} estado="rubi" />);
        const escudo = container.querySelector('[data-centro="escudo"]');
        expect(escudo?.getAttribute("class")).toContain("fill-rubi");
    });
});
