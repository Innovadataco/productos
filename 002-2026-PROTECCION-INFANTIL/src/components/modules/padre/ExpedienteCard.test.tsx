import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpedienteCard } from "./ExpedienteCard";

vi.mock("next/link", () => ({
    default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

describe("ExpedienteCard (SPEC-232)", () => {
    it("renderiza identificador, estado, eventos y score", () => {
        render(
            <ExpedienteCard
                id="exp-1"
                identificadorReportado="@usuario123"
                estado="ACTIVO"
                scoreGravedadActual="ROJO"
                fechaApertura={new Date("2026-08-20T10:00:00Z")}
                ultimoEventoEn={new Date("2026-08-23T10:00:00Z")}
                numEventos={3}
            />
        );

        expect(screen.getByText("@usuario123")).toBeDefined();
        expect(screen.getByText("Activo · 3 eventos")).toBeDefined();
        expect(screen.getByText("Nivel crítico")).toBeDefined();
        expect(screen.getByRole("link").getAttribute("href")).toBe("/dashboard/padre/expedientes/exp-1");
    });

    it("muestra 'Hoy' cuando el último evento es hoy", () => {
        render(
            <ExpedienteCard
                id="exp-2"
                identificadorReportado="+573001234567"
                estado="ACTIVO"
                scoreGravedadActual="VERDE"
                fechaApertura={new Date()}
                ultimoEventoEn={new Date()}
                numEventos={1}
            />
        );

        expect(screen.getByText("Hoy")).toBeDefined();
    });
});
