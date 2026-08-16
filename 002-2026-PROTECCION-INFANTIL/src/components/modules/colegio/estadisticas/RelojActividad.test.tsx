/**
 * SPEC-158 (T005, US2, FR-004) — RelojActividad: SVG propio con 24 posiciones,
 * barras solo en las horas con actividad, resumen accesible con el rango pico
 * (ventana de 6 h) y estado vacío honesto. `ventanaPico` se prueba directo:
 * 02:00 UTC = 21 h Bogotá ya lo garantiza el repo; aquí va la lectura circular.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelojActividad, ventanaPico } from "./RelojActividad";

function horasCon(picos: Record<number, number>): number[] {
    const horas = Array.from({ length: 24 }, () => 0);
    for (const [hora, valor] of Object.entries(picos)) horas[Number(hora)] = valor;
    return horas;
}

describe("ventanaPico", () => {
    it("encuentra la ventana de 6 h con más reportes, cruzando medianoche", () => {
        // Actividad nocturna: 21, 22, 23, 0, 1 y 2 h → la ventana cruza las 0 h.
        const ventana = ventanaPico(horasCon({ 21: 2, 22: 3, 23: 4, 0: 5, 1: 3, 2: 2 }));
        expect(ventana).toEqual({ inicio: 21, fin: 2 });
    });

    it("sin actividad → null (estado vacío honesto)", () => {
        expect(ventanaPico(horasCon({}))).toBeNull();
    });
});

describe("RelojActividad", () => {
    it("dibuja barras solo en las horas con reportes y resume el rango pico en el aria-label", () => {
        render(<RelojActividad horas={horasCon({ 21: 3, 22: 2, 9: 1 })} />);
        const reloj = screen.getByRole("img", { name: /Reloj de actividad de 24 horas/ });
        expect(reloj.getAttribute("aria-label")).toContain("6 reportes en total");
        expect(reloj.getAttribute("aria-label")).toContain("hora de Colombia");

        const barras = document.querySelectorAll("[data-hora]");
        expect(barras).toHaveLength(3); // solo horas con actividad, nunca picos inventados
        expect(document.querySelector('[data-hora="21"]')?.getAttribute("data-reportes")).toBe("3");
        expect(document.querySelector('[data-hora="9"]')).toBeTruthy();
        expect(document.querySelector('[data-hora="12"]')).toBeNull();
    });

    it("las 24 horas tienen su marca y las etiquetas 0/6/12/18 h", () => {
        const { container } = render(<RelojActividad horas={horasCon({ 14: 1 })} />);
        const textos = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
        expect(textos).toEqual(["0 h", "6 h", "12 h", "18 h"]);
    });

    it("estado vacío: copy honesto, sin barras ni rango pico", () => {
        render(<RelojActividad horas={horasCon({})} />);
        expect(screen.getByText(/Aún no hay actividad suficiente para leer el reloj/)).toBeTruthy();
        expect(document.querySelectorAll("[data-hora]")).toHaveLength(0);
        const reloj = screen.getByRole("img", { name: /aún no hay actividad registrada/ });
        expect(reloj).toBeTruthy();
    });
});
