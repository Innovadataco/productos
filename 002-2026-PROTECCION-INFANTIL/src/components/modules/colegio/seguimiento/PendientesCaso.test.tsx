/**
 * SPEC-159 (T005, FR-005): tests de PendientesCaso — pendientes computados del
 * servidor, verbos que llaman al endpoint EXISTENTE de estado y copy positivo
 * cuando el caso está al día.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PendientesCaso } from "./PendientesCaso";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh }),
}));

describe("PendientesCaso", () => {
    beforeEach(() => {
        vi.spyOn(global, "fetch").mockResolvedValue({
            ok: true,
            json: async () => ({ alerta: { id: "a1", estado: "vista" } }),
        } as Response);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        refresh.mockClear();
    });

    it("caso al día: copy positivo, sin verbos", () => {
        render(<PendientesCaso pendientes={[]} alertaId="a1" />);
        expect(screen.getByText("Caso al día")).toBeDefined();
        expect(screen.getByText(/Quedó registrado lo actuado/)).toBeDefined();
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("con pendientes: textos y el verbo de estado llama al endpoint EXISTENTE", async () => {
        render(
            <PendientesCaso
                pendientes={[
                    { clave: "revisar", texto: "Revisa la alerta: márcala como vista cuando la leas" },
                    { clave: "registrar", texto: "Registra lo que hiciste en la bitácora" },
                ]}
                alertaId="a1"
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Marcar como vista" }));
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/colegio/alertas/a1/estado",
                expect.objectContaining({ method: "PATCH", body: JSON.stringify({ estado: "vista" }) })
            );
        });
        await waitFor(() => expect(refresh).toHaveBeenCalled());

        // "Registrar" no tiene botón de estado: enlaza a la bitácora.
        const enlace = screen.getByRole("link", { name: /Ir a la bitácora/ });
        expect(enlace.getAttribute("href")).toBe("#bitacora");
    });
});
