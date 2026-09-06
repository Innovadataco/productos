/**
 * SPEC-143 (T005) → SPEC-560 (D-120) — HeroEstado por estado SEMÁNTICO.
 * D-120: PENDIENTE=ámbar con CTA; ATENDIDO/TRANQUILO=pino; el rubí NO vive en el
 * hero (queda para la alerta de alto riesgo en su tarjeta).
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroEstado } from "./HeroEstado";

describe("HeroEstado (D-120)", () => {
    it("TRANQUILO: declaración tranquila, luz pino, sin CTA", () => {
        const { container } = render(<HeroEstado estado="TRANQUILO" />);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("tranquilo");
        expect(screen.getByText(/Sin alertas nuevas/)).toBeTruthy();
        const punto = container.querySelector('[data-punto-estado="pino"]');
        expect(punto?.getAttribute("class")).toContain("anim-pulso");
        expect(punto?.getAttribute("class")).toContain("bg-pino");
        expect(container.querySelector("[data-estado='pino']")).toBeTruthy(); // LuzAmbiental
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("ATENDIDO: dice que ya está atendido, en PINO (no ámbar), etiqueta «Al día», sin CTA", () => {
        const { container } = render(<HeroEstado estado="ATENDIDO" />);
        const titular = screen.getByRole("heading", { level: 1 }).textContent ?? "";
        expect(titular).toContain("ya lo atendió");
        expect(screen.getByText(/no tiene nada pendiente/i)).toBeTruthy();
        expect(screen.getByText(/Al día/)).toBeTruthy();
        expect(container.querySelector('[data-punto-estado="pino"]')).toBeTruthy();
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("PENDIENTE: «necesita que actúe hoy» en ÁMBAR (no rubí) con CTA a las alertas", () => {
        const { container } = render(<HeroEstado estado="PENDIENTE" />);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("necesita que actúe hoy");
        const cta = screen.getByRole("link", { name: /Ver alertas/ });
        expect(cta.getAttribute("href")).toBe("/dashboard/colegio/alertas");
        // D-120: PENDIENTE es ámbar, NO rubí.
        expect(container.querySelector('[data-punto-estado="ambar"]')).toBeTruthy();
        expect(container.querySelector('[data-punto-estado="rubi"]')).toBeNull();
        expect(container.innerHTML).not.toContain("bg-rubi");
    });
});
