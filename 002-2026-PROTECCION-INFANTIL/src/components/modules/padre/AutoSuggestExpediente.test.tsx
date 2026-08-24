import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AutoSuggestExpediente } from "./AutoSuggestExpediente";

vi.mock("next/link", () => ({
    default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

describe("AutoSuggestExpediente (SPEC-232)", () => {
    it("muestra identificador y días desde última actualización", () => {
        const hace5Dias = new Date();
        hace5Dias.setDate(hace5Dias.getDate() - 5);

        render(
            <AutoSuggestExpediente
                expedienteId="exp-1"
                identificadorReportado="@usuario123"
                ultimoEventoEn={hace5Dias}
            />
        );

        expect(screen.getByText(/¿La situación continúa?/)).toBeDefined();
        expect(screen.getByText(/@usuario123/)).toBeDefined();
        expect(screen.getByText(/5 días/)).toBeDefined();
        expect(screen.getByRole("link", { name: "Agregar nueva situación" }).getAttribute("href")).toBe(
            "/dashboard/padre/expedientes/exp-1"
        );
    });

    it("muestra botón 'Ya se resolvió' deshabilitado", () => {
        render(
            <AutoSuggestExpediente
                expedienteId="exp-2"
                identificadorReportado="+573001234567"
                ultimoEventoEn={new Date()}
            />
        );

        const boton = screen.getByRole("button", { name: "Ya se resolvió" });
        expect(boton).toBeDefined();
        expect(boton.hasAttribute("disabled")).toBe(true);
    });
});
