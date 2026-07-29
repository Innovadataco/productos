import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
        expect(document.body.textContent).toContain("¿Qué identificador está asociado a la situación?");
    });

    it("no muestra bloqueo cuando no hay sesión (anónimo puro)", async () => {
        mockFetch({ error: { message: "No autenticado" } }, false);
        render(<ReporteWizard />);

        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Las cuentas internas no pueden crear reportes");
        });
        expect(document.body.textContent).toContain("¿Qué identificador está asociado a la situación?");
    });

    // Test de EFECTO (I-14): el botón "Siguiente" del paso 2 obedece el parámetro
    // reportes.spam.min_text_length, no un literal. Con el parámetro en 30, un texto
    // de 29 caracteres bloquea el avance y uno de 31 lo habilita.
    it("el botón Siguiente del paso 2 obedece reportes.spam.min_text_length (test de efecto)", async () => {
        vi.spyOn(global, "fetch").mockImplementation(async (input) => {
            const url = String(input);
            const json = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
            if (url.includes("/api/me")) return json({ error: { message: "No autenticado" } }, false);
            if (url.includes("/api/config/parametros/publicos")) {
                return json({ "reportes.spam.min_text_length": { valor: "30" } });
            }
            if (url.includes("/api/plataformas")) {
                return json({ plataformas: [{ id: "p1", clave: "whatsapp", nombre: "WhatsApp" }] });
            }
            if (url.includes("/api/paises")) return json({ paises: [{ id: "co", nombre: "Colombia" }] });
            // SPEC-115: la ciudad se elige con buscador en servidor
            if (url.includes("/api/ciudades/buscar")) {
                return json({ ciudades: [{ id: "bog", nombre: "Bogotá", paisId: "co", departamentoId: null, departamento: null }] });
            }
            return json({});
        });
        render(<ReporteWizard />);

        // Paso 1: identificador + plataforma
        fireEvent.change(await screen.findByLabelText(/Número, nick o usuario/i), { target: { value: "+573001234567" } });
        await screen.findByRole("option", { name: "WhatsApp" });
        fireEvent.change(screen.getByLabelText(/Plataforma/i), { target: { value: "whatsapp" } });
        fireEvent.click(screen.getByRole("button", { name: /Siguiente/i }));

        // Paso 2: país + ciudad (buscador con debounce en servidor)
        await screen.findByText("Detalles del incidente");
        await screen.findByRole("option", { name: "Colombia" });
        fireEvent.change(screen.getByLabelText(/País/i), { target: { value: "co" } });
        fireEvent.change(screen.getByRole("combobox", { name: /Ciudad/i }), { target: { value: "Bog" } });
        fireEvent.click(await screen.findByRole("option", { name: /Bogotá/ }));

        const area = screen.getByPlaceholderText(/Describe la conducta observada/i);
        const botonSiguiente = () => screen.getByRole("button", { name: /Siguiente/i });

        // N-1 = 29 caracteres → avance bloqueado
        fireEvent.change(area, { target: { value: "a".repeat(29) } });
        await waitFor(() => expect(botonSiguiente()).toHaveProperty("disabled", true));

        // N+1 = 31 caracteres → avance habilitado
        fireEvent.change(area, { target: { value: "a".repeat(31) } });
        await waitFor(() => expect(botonSiguiente()).toHaveProperty("disabled", false));
    });
});
