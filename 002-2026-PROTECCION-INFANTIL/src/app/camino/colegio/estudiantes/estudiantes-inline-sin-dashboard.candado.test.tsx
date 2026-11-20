/**
 * SPEC-956 (Jelkin vivo, prod e3d0f98f) · CANDADO: el Paso 5 (estudiantes) del camino
 * del colegio se resuelve DENTRO del paso — nunca enlaza a /dashboard.
 *
 * El defecto: los dos botones eran `<Link>` a `/dashboard/colegio/...`, que SACABAN
 * al rector del camino → no podía terminarlo. MUERE si vuelve a aparecer un enlace a
 * /dashboard, si el alta deja de ser inline (navega en vez de abrir en la misma
 * pantalla), o si «Terminar» deja de exigir ≥1 estudiante.
 *
 * Unit (jsdom): mockea next/navigation y fetch. Registrado en vitest.unit.includes.ts.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// SPEC-962: «Terminar» cierra el camino por SERVER ACTION (redirige server-side al
// panel), ya no por navegación cliente a /listo. Se mockea la acción para el unit.
const completarAction = vi.fn();
vi.mock("./actions", () => ({ accionCompletarCaminoColegio: () => completarAction() }));

import PasoEstudiantesColegio from "./page";

const CURSOS = [{ id: "c1", nombre: "6A" }, { id: "c2", nombre: "7B" }];

function mockFetch({ total = 0, items = [] as unknown[] } = {}) {
    const fn = vi.fn((url: string) => {
        const u = String(url);
        if (u.includes("/api/colegio/estudiantes")) {
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ items, pagination: { page: 1, pageSize: 100, total, totalPages: 1 } }) });
        }
        if (u.includes("/api/colegio/cursos")) {
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ cursos: CURSOS }) });
        }
        // tipos-documento (cuando abre el modal) — el hook tiene fallback hardcode.
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [{ clave: "TI", nombre: "Tarjeta de identidad" }] }) });
    });
    vi.stubGlobal("fetch", fn);
    return fn;
}

beforeEach(() => {
    push.mockClear();
    completarAction.mockClear();
    vi.unstubAllGlobals();
});

describe("SPEC-956 · Paso 5 estudiantes: inline, sin salir a /dashboard", () => {
    it("NO contiene ningún enlace a /dashboard; ofrece selector de curso, alta y Atrás", async () => {
        mockFetch({ total: 0, items: [] });
        const { container } = render(<PasoEstudiantesColegio />);
        await screen.findByText("Aún no ha agregado estudiantes.");

        // El defecto exacto: cero anclas a /dashboard.
        expect(container.querySelectorAll('a[href*="/dashboard"]').length).toBe(0);
        // Controles del paso, inline.
        expect(screen.getByLabelText("¿En qué curso?")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Agregar estudiante" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Atrás" })).toBeTruthy();
        // Sin estudiantes: Terminar deshabilitado + copy honesto.
        expect((screen.getByRole("button", { name: "Terminar" }) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText("Agregue su primer estudiante para terminar.")).toBeTruthy();
    });

    it("con ≥1 estudiante activo, «Terminar» se habilita y cierra el camino por SERVER ACTION (SPEC-962), sin navegar a /listo", async () => {
        mockFetch({ total: 1, items: [{ id: "e1", nombre: "María Gómez", curso: { id: "c1", nombre: "6A" } }] });
        render(<PasoEstudiantesColegio />);
        await screen.findByText("María Gómez");

        const terminar = screen.getByRole("button", { name: "Terminar" }) as HTMLButtonElement;
        expect(terminar.disabled).toBe(false);
        fireEvent.click(terminar);
        // SPEC-962: ya NO es router.push('/camino/colegio/listo'); llama a la acción que
        // cierra el camino y redirige server-side al panel.
        await waitFor(() => expect(completarAction).toHaveBeenCalled());
        expect(push).not.toHaveBeenCalledWith("/camino/colegio/listo");
    });

    it("«Agregar estudiante» abre el alta INLINE (misma pantalla), sin navegar a ningún lado", async () => {
        mockFetch({ total: 0, items: [] });
        render(<PasoEstudiantesColegio />);
        await screen.findByLabelText("¿En qué curso?");

        // Elegir curso habilita el botón; abrir NO navega.
        fireEvent.change(screen.getByLabelText("¿En qué curso?"), { target: { value: "c1" } });
        fireEvent.click(screen.getByRole("button", { name: "Agregar estudiante" }));

        // El formulario del estudiante aparece en la misma pantalla (campo propio del modal).
        expect(await screen.findByLabelText(/Nombre del estudiante/)).toBeTruthy();
        // Nunca sacó al rector del camino.
        expect(push).not.toHaveBeenCalled();
    });
});
