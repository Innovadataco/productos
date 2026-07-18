import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ReporteWizard } from "./ReporteWizard";

function mockFetch(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        json: async () => response,
    } as Response);
}

describe("ReporteWizard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra bloqueo para sesión interna (ADMIN)", async () => {
        mockFetch({ id: "u1", email: "admin@test.com", nombre: "Admin", rol: "ADMIN" });
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).toContain("Las cuentas internas no pueden crear reportes");
        });
        expect(screen.getByRole("button", { name: /Cerrar sesión y reportar/i })).toBeDefined();
    });

    it("muestra bloqueo para sesión interna (OPERADOR)", async () => {
        mockFetch({ id: "u2", email: "op@test.com", nombre: "Operador", rol: "OPERADOR" });
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).toContain("Las cuentas internas no pueden crear reportes");
        });
    });

    it("muestra bloqueo para sesión interna (SCHOOL_ADMIN)", async () => {
        mockFetch({ id: "u3", email: "school@test.com", nombre: "School", rol: "SCHOOL_ADMIN" });
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).toContain("Las cuentas internas no pueden crear reportes");
        });
    });

    it("no muestra bloqueo para usuario PARENT", async () => {
        mockFetch({ id: "u4", email: "parent@test.com", nombre: "Padre", rol: "PARENT" });
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Las cuentas internas no pueden crear reportes");
        });
        expect(document.body.textContent).toContain("¿Qué identificador quieres reportar?");
    });

    it("no muestra bloqueo cuando no hay sesión (anónimo puro)", async () => {
        mockFetch({ error: { message: "No autenticado" } }, false);
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Las cuentas internas no pueden crear reportes");
        });
        expect(document.body.textContent).toContain("¿Qué identificador quieres reportar?");
    });
});
