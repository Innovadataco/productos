import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NuevoColegioPageClient from "./NuevoColegioPageClient";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => "/dashboard/admin/colegios/nuevo",
    useSearchParams: () => new URLSearchParams(),
}));

function fillForm() {
    fireEvent.change(screen.getByLabelText("Nombre del colegio"), {
        target: { value: "Colegio Ejemplo" },
    });
    fireEvent.change(screen.getByLabelText("Nombre del rector"), {
        target: { value: "Ana Rectora" },
    });
    fireEvent.change(screen.getByLabelText("Email del rector"), {
        target: { value: "rector@ejemplo.edu.co" },
    });
}

describe("NuevoColegioPageClient — pre-registro simplificado (SPEC-240)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renderiza solo los 3 campos del pre-registro", () => {
        render(<NuevoColegioPageClient />);

        expect(screen.getByLabelText("Nombre del colegio")).toBeTruthy();
        expect(screen.getByLabelText("Nombre del rector")).toBeTruthy();
        expect(screen.getByLabelText("Email del rector")).toBeTruthy();
        expect(screen.queryByLabelText("País")).toBeNull();
        expect(screen.queryByText("Representante legal")).toBeNull();
        expect(screen.queryByText("Vigencia del servicio")).toBeNull();
    });

    it("envía el payload simplificado y muestra el modal al crear con éxito", async () => {
        const fetchMock = vi.mocked(globalThis.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ mensaje: "Invitación enviada" }),
        } as Response);

        render(<NuevoColegioPageClient />);
        fillForm();
        fireEvent.click(screen.getByRole("button", { name: "Enviar invitación" }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/admin/colegios",
                expect.objectContaining({
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nombre: "Colegio Ejemplo",
                        nombreRector: "Ana Rectora",
                        emailRector: "rector@ejemplo.edu.co",
                    }),
                })
            );
        });

        expect(screen.getByRole("dialog")).toBeTruthy();
        expect(
            screen.getByText("✓ Invitación enviada · el rector recibió email para activar su cuenta")
        ).toBeTruthy();
    });

    it("muestra error si el servidor responde con fallo", async () => {
        vi.mocked(globalThis.fetch).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: { message: "El email ya está registrado" } }),
        } as Response);

        render(<NuevoColegioPageClient />);
        fillForm();
        fireEvent.click(screen.getByRole("button", { name: "Enviar invitación" }));

        await waitFor(() => {
            expect(screen.getByText("El email ya está registrado")).toBeTruthy();
        });
    });

    it("no envía el formulario si faltan campos requeridos", () => {
        render(<NuevoColegioPageClient />);
        fireEvent.click(screen.getByRole("button", { name: "Enviar invitación" }));

        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("no muestra banner de contraseña temporal (BUG-01)", () => {
        render(<NuevoColegioPageClient />);
        expect(screen.queryByText(/Contraseña temporal/)).toBeNull();
    });
});
