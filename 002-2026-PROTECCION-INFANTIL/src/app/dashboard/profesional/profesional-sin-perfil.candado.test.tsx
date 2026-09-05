/**
 * SPEC-481 (bug en prod, lo pegó Jelkin en vivo): un PROFESIONAL registrado que
 * todavía NO completó su `PerfilProfesional` caía en 500 en su propia home
 * `/dashboard/profesional` — `panelDelProfesional` lanza NOT_FOUND y, en un Server
 * Component, eso es un 500. Conducta correcta: redirigir a
 * `/perfil-profesional/completar` (el onboarding); con perfil, el panel normal.
 *
 * Candado de CONDUCTA (mockea auth + service + redirect, sin BD). Muere por mutación:
 * quitar el catch/redirect de `page.tsx` deja propagar el NOT_FOUND → el primer test
 * falla (no llama a redirect). Además vigila que NO enmascare otros errores.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppError, ERROR_CODES } from "@/lib/errors";

const verifyAuthMock = vi.fn();
const panelMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
    // Emula next/navigation.redirect: corta la ejecución lanzando (como en Next).
    throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({ redirect: (p: string) => redirectMock(p) }));
vi.mock("@/lib/auth", () => ({ verifyAuth: (...a: unknown[]) => verifyAuthMock(...a) }));
vi.mock("@/lib/profesional/panel/panel.service", () => ({
    panelDelProfesional: (...a: unknown[]) => panelMock(...a),
}));
vi.mock("@/components/modules/profesional/PanelProfesional", () => ({
    PanelProfesional: ({ data }: { data: unknown }) => (
        <div data-testid="panel">{JSON.stringify(data)}</div>
    ),
}));

import ProfesionalInicioPage from "./page";

describe("SPEC-481 · profesional sin perfil → completar (no 500)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        verifyAuthMock.mockResolvedValue({ id: "prof-1", rol: "PROFESIONAL" });
        redirectMock.mockImplementation((path: string) => {
            throw new Error(`NEXT_REDIRECT:${path}`);
        });
    });

    it("sin PerfilProfesional: redirige a /perfil-profesional/completar (no 500)", async () => {
        panelMock.mockRejectedValue(
            new AppError("Perfil profesional no encontrado", ERROR_CODES.NOT_FOUND, 404),
        );
        await expect(ProfesionalInicioPage()).rejects.toThrow(
            "NEXT_REDIRECT:/perfil-profesional/completar",
        );
        expect(redirectMock).toHaveBeenCalledWith("/perfil-profesional/completar");
    });

    it("con PerfilProfesional: renderiza el panel, sin redirigir", async () => {
        panelMock.mockResolvedValue({ nombreVisible: "Dra. Test" });
        const jsx = await ProfesionalInicioPage();
        render(jsx as React.ReactElement);
        expect(screen.getByTestId("panel")).toBeTruthy();
        expect(redirectMock).not.toHaveBeenCalled();
    });

    it("otro error (no NOT_FOUND) se propaga y NO redirige (no enmascara fallos reales)", async () => {
        panelMock.mockRejectedValue(new AppError("boom", ERROR_CODES.INTERNAL_ERROR, 500));
        await expect(ProfesionalInicioPage()).rejects.toThrow("boom");
        expect(redirectMock).not.toHaveBeenCalled();
    });
});
