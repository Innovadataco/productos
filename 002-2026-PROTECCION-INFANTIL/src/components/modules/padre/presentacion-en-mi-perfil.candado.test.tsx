/**
 * CANDADO · SPEC-729 (Jelkin probando 24-09 · 5.ª vez) · la presentación del padre
 * se EDITA desde «Mi perfil». Hasta hoy solo se escribía en el panel «Antes de
 * conocer a alguien» y se re-pedía en cada búsqueda de psicólogo; ahora vive en el
 * perfil (PerfilPadreForm).
 *
 * Conducta (no menciones) — variante "perfil":
 *  1. PRECARGA `presentacionEstandar` del GET /api/padre/perfil.
 *  2. Al guardar, MANDA `presentacionEstandar` en el PATCH (con texto → lo guarda).
 *  3. Control positivo / por remoción · variante "camino": NO existe el campo de
 *     presentación (ahí se piden otros campos; la presentación es solo del perfil).
 *
 * Nota de alcance: la presentación DENTRO de la solicitud de cita (precarga desde
 * Mi perfil, mínimo único) es SPEC-729 §2 — pendiente de forma de Diseño; este
 * candado NO toca esa pantalla. Voz padre = tú.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PerfilPadreForm } from "./PerfilPadreForm";

interface Llamada {
    url: string;
    method: string;
    body: Record<string, unknown> | undefined;
}

function stubFetch(perfilOver: Record<string, unknown> = {}): Llamada[] {
    const llamadas: Llamada[] = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
            const method = init?.method ?? "GET";
            llamadas.push({
                url: String(url),
                method,
                body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
            });
            if (String(url).startsWith("/api/padre/perfil") && method === "GET") {
                return {
                    ok: true,
                    json: async () => ({
                        perfil: {
                            email: "a@b.co", nombre: "Ana", apellidos: "Ruiz",
                            documentoTipo: "CC", documentoNumero: "1",
                            fechaNacimiento: null, telefono: null, paisId: null, ciudadId: null,
                            paisPerfil: null, ciudadPerfil: null,
                            presentacionEstandar: null, urgenciaEstandar: null,
                            ...perfilOver,
                        },
                    }),
                };
            }
            if (String(url).startsWith("/api/paises")) return { ok: true, json: async () => ({ paises: [] }) };
            return { ok: true, json: async () => ({ ok: true }) };
        }),
    );
    return llamadas;
}

const PLACEHOLDER = /Roblox/;

beforeEach(() => vi.restoreAllMocks());

describe("SPEC-729 · la presentación del padre se edita desde Mi perfil", () => {
    it("perfil: PRECARGA presentacionEstandar del GET", async () => {
        stubFetch({ presentacionEstandar: "Soy la mamá de Ana, 12 años." });
        render(<PerfilPadreForm />);
        const ta = (await screen.findByPlaceholderText(PLACEHOLDER)) as HTMLTextAreaElement;
        expect(ta.value).toBe("Soy la mamá de Ana, 12 años.");
    });

    it("perfil: al guardar, MANDA presentacionEstandar en el PATCH", async () => {
        const llamadas = stubFetch({ presentacionEstandar: "Texto viejo suficiente." });
        render(<PerfilPadreForm />);
        const ta = (await screen.findByPlaceholderText(PLACEHOLDER)) as HTMLTextAreaElement;
        fireEvent.change(ta, { target: { value: "Situación nueva del menor: mensajes que preocupan." } });
        fireEvent.click(screen.getByRole("button", { name: /Guardar mis datos/ }));
        await waitFor(() => {
            const patch = llamadas.find((l) => l.url.startsWith("/api/padre/perfil") && l.method === "PATCH");
            expect(patch, "el PATCH del perfil no salió").toBeTruthy();
            expect(patch!.body?.presentacionEstandar).toBe("Situación nueva del menor: mensajes que preocupan.");
        });
    });

    it("CONTROL · camino: NO existe el campo de presentación (solo vive en el perfil)", async () => {
        stubFetch();
        render(<PerfilPadreForm variante="camino" />);
        await screen.findByLabelText("Nombres"); // espera a que cargue el formulario
        expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
        expect(screen.queryByText(/Tu presentación/)).toBeNull();
    });
});
