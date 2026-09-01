/**
 * SPEC-353 (A-69 · C6) — la tarjeta de la frase accionable.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueHacerHoyCard } from "./QueHacerHoyCard";

describe("QueHacerHoyCard (SPEC-353)", () => {
    it("tono ámbar: pinta título, detalle y botón de acción", () => {
        render(
            <QueHacerHoyCard
                frase={{
                    titulo: "Dos cosas necesitan su atención hoy",
                    detalle: "Dos avisos esperan su atención en la bandeja.",
                    accionHref: "/dashboard/colegio/alertas",
                    accionTexto: "Ver ahora",
                    tono: "ambar",
                }}
            />,
        );
        const card = screen.getByTestId("que-hacer-hoy");
        expect(card.getAttribute("data-tono")).toBe("ambar");
        expect(screen.getByText("Dos cosas necesitan su atención hoy")).toBeDefined();
        const link = screen.getByRole("link", { name: "Ver ahora" });
        expect(link.getAttribute("href")).toBe("/dashboard/colegio/alertas");
    });

    it("tono calma: sin clase de alerta ámbar", () => {
        render(
            <QueHacerHoyCard
                frase={{
                    titulo: "Todo al día",
                    detalle: "No hay nada que espere por usted en este momento.",
                    accionHref: "/dashboard/colegio/estadisticas",
                    accionTexto: "Ver el movimiento",
                    tono: "calma",
                }}
            />,
        );
        const card = screen.getByTestId("que-hacer-hoy");
        expect(card.getAttribute("data-tono")).toBe("calma");
        expect(card.className).not.toContain("ambar");
    });

    it("jamás usa rojo (regla del brief §0)", () => {
        render(
            <QueHacerHoyCard
                frase={{
                    titulo: "Algo necesita su atención hoy",
                    detalle: "Un aviso espera su atención en la bandeja.",
                    accionHref: "/dashboard/colegio/alertas",
                    accionTexto: "Ver ahora",
                    tono: "ambar",
                }}
            />,
        );
        expect(screen.getByTestId("que-hacer-hoy").outerHTML).not.toMatch(/red-|rubi/);
    });
});
