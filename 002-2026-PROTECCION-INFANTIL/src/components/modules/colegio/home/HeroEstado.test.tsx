/**
 * SPEC-143 (T005) — HeroEstado: declaración + luz ambiental + punto con pulso por
 * estado. CONDICIÓN DE COPY (ZEUS): el ámbar dice explícitamente "ya lo atendiste".
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroEstado } from "./HeroEstado";

describe("HeroEstado", () => {
    it("pino: declaración tranquila, luz pino y punto con pulso del sistema", () => {
        const { container } = render(<HeroEstado estado="pino" />);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("tranquilo");
        expect(screen.getByText(/Sin alertas nuevas/)).toBeTruthy();
        const punto = container.querySelector('[data-punto-estado="pino"]');
        expect(punto?.getAttribute("class")).toContain("anim-pulso");
        expect(punto?.getAttribute("class")).toContain("bg-pino");
        expect(container.querySelector("[data-estado='pino']")).toBeTruthy(); // LuzAmbiental
        expect(screen.queryByRole("link")).toBeNull(); // pino no tiene CTA
    });

    it("ámbar: el copy DICE que ya está atendido (nunca trabajo pendiente)", () => {
        render(<HeroEstado estado="ambar" />);
        const titular = screen.getByRole("heading", { level: 1 }).textContent ?? "";
        expect(titular).toContain("ya lo atendiste");
        expect(screen.getByText(/no tienes nada pendiente/i)).toBeTruthy();
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("rubí: palabra de urgencia y CTA a los avisos", () => {
        const { container } = render(<HeroEstado estado="rubi" />);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("necesita que actúes hoy");
        const cta = screen.getByRole("link", { name: /Ver avisos nuevos/ });
        expect(cta.getAttribute("href")).toBe("/dashboard/colegio/alertas");
        expect(container.querySelector('[data-punto-estado="rubi"]')).toBeTruthy();
    });
});
