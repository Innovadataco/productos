/**
 * SPEC-779 · CANDADO de render de la carga del operador (FORMA-SPEC779). Invariantes:
 *  - DOS cargas, cada una con su «/{tope}» propio; NUNCA un total combinado ni una barra única.
 *  - NUNCA un semáforo agregado «disponible/ocupado».
 *  - Al tope → ámbar (CERO rubí); sobre-tope → número REAL (no se recorta).
 *  - «Al tope de casos, vacío de sesiones» y su reverso se ven OPUESTOS (no iguales).
 * jsdom.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CargaDosTrabajos } from "@/components/modules/operadores/CargaDosTrabajos";

afterEach(() => cleanup());

const alTopeDe = (c: HTMLElement, clave: string) =>
    c.querySelector(`[data-carga="${clave}"]`)?.getAttribute("data-al-tope");
const fillClase = (c: HTMLElement, clave: string) =>
    c.querySelector(`[data-fill="${clave}"]`)?.getAttribute("class") ?? "";

describe("SPEC-779 · CargaDosTrabajos (render)", () => {
    it("muestra DOS cargas, cada una con su propio /{tope}; ninguna sola cifra ni suma", () => {
        const { container } = render(<CargaDosTrabajos casos={{ actual: 3, tope: 10 }} sesiones={{ actual: 15, tope: 20 }} />);
        expect(container.querySelectorAll("[data-carga]").length).toBe(2);
        expect(container.querySelectorAll("[data-fill]").length, "una barra por trabajo, no una sola").toBe(2);
        expect(screen.getByText("3/10")).toBeTruthy(); // casos contra SU tope
        expect(screen.getByText("15/20")).toBeTruthy(); // sesiones contra SU tope
        // NO hay un total combinado (ni «18», ni «3 + 15», ni un denominador sumado 30).
        expect(container.textContent).not.toContain("18");
        expect(container.textContent).not.toContain("30");
        expect(container.querySelector("[data-total]"), "no debe existir un total combinado").toBeNull();
    });

    it("NO hay semáforo de disponibilidad agregado (ni «disponible» ni «ocupado»)", () => {
        const { container } = render(<CargaDosTrabajos casos={{ actual: 10, tope: 10 }} sesiones={{ actual: 0, tope: 20 }} />);
        expect(/disponible|ocupado/i.test(container.textContent ?? "")).toBe(false);
    });

    it("al tope → ámbar y «al tope», CERO rubí; bajo el tope → cielo", () => {
        const { container } = render(<CargaDosTrabajos casos={{ actual: 10, tope: 10 }} sesiones={{ actual: 2, tope: 20 }} />);
        expect(alTopeDe(container, "casos")).toBe("true");
        expect(fillClase(container, "casos")).toContain("bg-ambar");
        expect(alTopeDe(container, "sesiones")).toBe("false");
        expect(fillClase(container, "sesiones")).toContain("bg-cielo");
        expect(screen.getByText("al tope")).toBeTruthy();
        // D-120: nunca rubí en esta superficie de carga.
        expect(container.textContent).toBeTruthy();
        expect(container.innerHTML).not.toContain("bg-rubi");
    });

    it("«al tope de casos, vacío de sesiones» se ve OPUESTO a su reverso (no iguales)", () => {
        // Escenario A: casos al tope, sesiones vacío. Capturo antes de cleanup (los nodos se desmontan).
        const a = render(<CargaDosTrabajos casos={{ actual: 10, tope: 10 }} sesiones={{ actual: 0, tope: 20 }} />).container;
        const aCasosAlTope = alTopeDe(a, "casos");
        const aSesionesAlTope = alTopeDe(a, "sesiones");
        const aCasosFill = fillClase(a, "casos");
        cleanup();
        // Escenario B (reverso): casos vacío, sesiones al tope.
        const b = render(<CargaDosTrabajos casos={{ actual: 0, tope: 10 }} sesiones={{ actual: 20, tope: 20 }} />).container;
        expect(aCasosAlTope).toBe("true");
        expect(aSesionesAlTope).toBe("false");
        expect(alTopeDe(b, "casos")).toBe("false");
        expect(alTopeDe(b, "sesiones")).toBe("true");
        // El trabajo saturado es el OPUESTO en cada escenario (no se ven iguales).
        expect(aCasosFill).toContain("bg-ambar");
        expect(fillClase(b, "sesiones")).toContain("bg-ambar");
    });

    it("sobre-tope: muestra el número REAL (n>tope), barra ámbar (no recorta la verdad)", () => {
        const { container } = render(<CargaDosTrabajos casos={{ actual: 13, tope: 10 }} sesiones={{ actual: 1, tope: 20 }} />);
        expect(screen.getByText("13/10")).toBeTruthy(); // el número real, aunque n>tope
        expect(alTopeDe(container, "casos")).toBe("true");
        expect(fillClase(container, "casos")).toContain("bg-ambar");
    });
});
