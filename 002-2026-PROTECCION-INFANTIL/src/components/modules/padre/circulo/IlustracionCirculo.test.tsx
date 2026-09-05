/**
 * SPEC-440 P2 (Jelkin vivo 04-09) · La ilustración del círculo pinta TODAS las
 * personas hasta el tope 20 del brief. El bug reportado: con 5 personas se
 * dibujaban 4. Candado por CONDUCTA: contamos los círculos «persona» que el
 * SVG renderiza para distintos tamaños de entrada. Muere si alguien vuelve al
 * `slice(0, 4)` original.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { IlustracionCirculo } from "./IlustracionCirculo";
import type { Contacto } from "./tipos";

function crearContactos(n: number): Contacto[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `c${i}`,
        nombre: `Persona ${i + 1}`,
        parentesco: null,
        etiqueta: null,
        nota: null,
        activo: true,
        creadoEn: "2026-09-01T00:00:00.000Z",
        estado: "sinReportes" as const,
        totalReportes: 0,
        identificadores: [],
    }));
}

/**
 * Cuenta los círculos «persona» del anillo. El SVG tiene:
 *   · 1 círculo grande centro (radio 46, el «tú y tus hijos»).
 *   · 1 círculo pequeño de la cabeza del padre (radio 9).
 *   · 2 círculos de los hijos (radio 6).
 *   · 1 círculo del anillo exterior (dasharray).
 *   · N círculos de personas (radio adaptativo — 10..18).
 *   · Opcional: 1 círculo de halo (ámbar, r = rAvatar+6) por cada persona en
 *     atención (no aplica en este test, todos verdes).
 *   · Opcional: M círculos de «lugar libre» dashArray "3 3".
 * Para aislar personas, filtramos por: r entre 10 y 18 sin `strokeDasharray`.
 */
function contarPuestosOcupados(container: HTMLElement): number {
    const circles = container.querySelectorAll("circle");
    let n = 0;
    for (const c of Array.from(circles)) {
        const r = Number(c.getAttribute("r") ?? "0");
        const dash = c.getAttribute("strokeDasharray") ?? c.getAttribute("stroke-dasharray");
        if (r >= 10 && r <= 18 && !dash) n++;
    }
    return n;
}

function contarLugaresLibres(container: HTMLElement): number {
    const circles = container.querySelectorAll("circle");
    let n = 0;
    for (const c of Array.from(circles)) {
        const dash = c.getAttribute("stroke-dasharray") ?? c.getAttribute("strokeDasharray");
        if (dash === "3 3") n++;
    }
    return n;
}

describe("SPEC-440 P2 · IlustracionCirculo pinta hasta 20 personas", () => {
    it("con 0 contactos: 4 lugares libres, 0 puestos ocupados", () => {
        const { container } = render(<IlustracionCirculo contactos={[]} />);
        expect(contarLugaresLibres(container)).toBe(4);
        expect(contarPuestosOcupados(container)).toBe(0);
    });

    it("con 3 contactos: 3 ocupados + 1 lugar libre", () => {
        const { container } = render(<IlustracionCirculo contactos={crearContactos(3)} />);
        expect(contarPuestosOcupados(container)).toBe(3);
        expect(contarLugaresLibres(container)).toBe(1);
    });

    it("con 4 contactos: los 4 puestos ocupados, sin lugares libres", () => {
        const { container } = render(<IlustracionCirculo contactos={crearContactos(4)} />);
        expect(contarPuestosOcupados(container)).toBe(4);
        expect(contarLugaresLibres(container)).toBe(0);
    });

    // Vector del defecto reportado: antes se pintaban solo 4 aunque hubiera 5.
    it("con 5 contactos: pinta 5 personas (no 4)", () => {
        const { container } = render(<IlustracionCirculo contactos={crearContactos(5)} />);
        expect(contarPuestosOcupados(container)).toBe(5);
        expect(contarLugaresLibres(container)).toBe(0);
    });

    it("con 10 contactos: pinta 10", () => {
        const { container } = render(<IlustracionCirculo contactos={crearContactos(10)} />);
        expect(contarPuestosOcupados(container)).toBe(10);
    });

    it("con 20 contactos (tope brief): pinta los 20 sin colapsar", () => {
        const { container } = render(<IlustracionCirculo contactos={crearContactos(20)} />);
        expect(contarPuestosOcupados(container)).toBe(20);
        expect(contarLugaresLibres(container)).toBe(0);
    });

    it("aria-label reporta el total exacto (accesibilidad honesta)", () => {
        const { container } = render(<IlustracionCirculo contactos={crearContactos(7)} />);
        const svg = container.querySelector("svg");
        expect(svg?.getAttribute("aria-label")).toContain("7 personas");
    });
});
