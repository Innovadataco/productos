import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ActivarForm } from "./ActivarForm";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}));

describe("ActivarForm", () => {
    beforeEach(() => {
        mockPush.mockClear();
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

    it("llama al endpoint y redirige a /consentimiento al activar", async () => {
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
            expect(mockPush).toHaveBeenCalledWith("/consentimiento");
        });
    });
});
