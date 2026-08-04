/**
 * SPEC-143 (T006, SC-003) — AnillosProteccion: fixture 70/50 con huecos en
 * personas; con 0 estudiantes muestra "sin datos aún" (cero NaN) y convida a crear
 * el primer curso.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnillosProteccion } from "./AnillosProteccion";

const FIXTURE = {
    vigilancia: 0.7,
    reaccion: 0.5,
    estudiantes: 10,
    sinRedes: 3,
    sinContacto: 5,
    estado: "pino" as const,
};

describe("AnillosProteccion", () => {
    it("dibuja el anillo 70/50 con la leyenda del hueco en personas (SC-003)", () => {
        render(<AnillosProteccion {...FIXTURE} />);
        const img = screen.getByRole("img");
        expect(img.getAttribute("aria-label")).toContain("70%");
        expect(img.getAttribute("aria-label")).toContain("50%");
        expect(screen.getByText("3 estudiantes sin redes registradas")).toBeTruthy();
        expect(screen.getByText("5 estudiantes sin acudiente a quien llamar")).toBeTruthy();
        expect(screen.getByText("10")).toBeTruthy();
    });

    it("con 0 estudiantes no dibuja el anillo: estado 'sin datos aún' con CTA al primer curso", () => {
        render(<AnillosProteccion {...FIXTURE} estudiantes={0} vigilancia={0} reaccion={0} sinRedes={0} sinContacto={0} />);
        expect(screen.queryByRole("img")).toBeNull();
        expect(screen.getByText(/Aún no hay estudiantes para dibujar/)).toBeTruthy();
        const cta = screen.getByRole("link", { name: /Crear primer curso/ });
        expect(cta.getAttribute("href")).toBe("/dashboard/colegio/cursos/unificado");
    });
});
