import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ActivarForm } from "./ActivarForm";

// I-411: tras activar, la navegación es DURA (window.location.assign) para que
// AuthProvider remonte con la cookie ya puesta y el menú no diga «Iniciar sesión»
// sobre el panel. jsdom no navega, así que se reemplaza `location` por un espía
// (patrón SPEC-362 · ModalConsentimiento). Antes este test afirmaba router.push:
// consagraba el defecto ([[ceo-el-texto-que-miente-sostiene-el-hueco]]).
const assign = vi.fn();
Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign },
});

describe("ActivarForm", () => {
    beforeEach(() => {
        assign.mockClear();
    });

    it("renderiza el formulario de contraseña", () => {
        render(<ActivarForm token="token-de-prueba" />);

        expect(screen.getByLabelText("Contraseña")).toBeTruthy();
        expect(screen.getByLabelText("Confirmar contraseña")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Activar cuenta" })).toBeTruthy();
    });

    it("muestra error si las contraseñas no coinciden", async () => {
        render(<ActivarForm token="token-de-prueba" />);

        fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Clave1234" } });
        fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "Otra1234" } });
        fireEvent.click(screen.getByRole("button", { name: "Activar cuenta" }));

        await waitFor(() => {
            expect(screen.getByText("Las contraseñas no coinciden.")).toBeTruthy();
        });
    });

    it("llama al endpoint y navega DURO a /consentimiento al activar (I-411)", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ user: { id: "u1", email: "rector@colegio.edu" } }),
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<ActivarForm token="token-de-prueba" />);

        fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Clave1234" } });
        fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "Clave1234" } });
        fireEvent.click(screen.getByRole("button", { name: "Activar cuenta" }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/auth/activar",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({ token: "token-de-prueba", password: "Clave1234" }),
                })
            );
            // Navegación DURA, no router.push: remonta AuthProvider con la cookie.
            expect(assign).toHaveBeenCalledWith("/consentimiento");
        });
    });
});
