/**
 * SPEC-176 (002-PI-073) — Cursos: toggle "Mostrar desactivados" + reactivación
 * desde la lista. El fetch cambia con el toggle y los inactivos ofrecen
 * "Activar" (los activos, "Desactivar").
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CursosPageClient from "./CursosPageClient";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/dashboard/colegio/cursos",
}));

const CURSOS_ACTIVOS = [{ id: "c1", nombre: "6A", grado: "Sexto", anioLectivo: "2026", estado: "activo" }];
const CURSOS_TODOS = [
    ...CURSOS_ACTIVOS,
    { id: "c2", nombre: "Curso DEMO 010", grado: "Décimo", anioLectivo: "2025", estado: "inactivo" },
];

function mockFetchPorUrl() {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
        const items = url.includes("incluirInactivos=true") ? CURSOS_TODOS : CURSOS_ACTIVOS;
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ cursos: items }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("CursosPageClient — SPEC-176 (ver y reactivar desactivados)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("por defecto pide solo activos; el toggle pide incluir inactivos y muestra el badge + Activar", async () => {
        const fetchMock = mockFetchPorUrl();
        render(<CursosPageClient />);

        // Default: solo activos (fetch sin el parámetro).
        await waitFor(() => expect(screen.getByText("6A")).toBeDefined());
        expect(fetchMock.mock.calls[0][0]).toBe("/api/colegio/cursos");
        expect(screen.queryByText("Curso DEMO 010")).toBeNull();

        // Activa el toggle → refetch con incluirInactivos=true.
        fireEvent.click(screen.getByLabelText("Mostrar desactivados"));
        await waitFor(() => expect(screen.getByText("Curso DEMO 010")).toBeDefined());
        expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("incluirInactivos=true"))).toBe(true);

        // El inactivo muestra su estado y ofrece Activar; el activo ofrece Desactivar.
        expect(screen.getByText("Inactivo")).toBeDefined();
        expect(screen.getByRole("button", { name: "Activar" })).toBeDefined();
        expect(screen.getByRole("button", { name: "Desactivar" })).toBeDefined();
    });

    // SPEC-377 (I-268) — Regla dura de Jelkin: NUNCA rojo (gris = inactivo,
    // ámbar = única alerta). Antes: "Desactivar" usaba `variant="danger"` →
    // `bg-red-700` (rgb(185,28,28)) — Calidad lo marcó como el único rojo real
    // del barrido integral. Este test barre TODOS los elementos renderizados y
    // afirma cero clases con `red-`, cero `bg-red`/`text-red`/`border-red`, y
    // cero estilos inline con "rgb(185,28,28)" en la pantalla completa (no solo
    // el botón). Si alguien vuelve a meter rojo, el test lo bloquea.
    it("SPEC-377 (I-268): la pantalla de cursos NO tiene ningún rojo (barrido de clases y estilos)", async () => {
        mockFetchPorUrl();
        const { container } = render(<CursosPageClient />);
        // Espera a que la lista pinte tanto activos como inactivos.
        fireEvent.click(await screen.findByLabelText("Mostrar desactivados"));
        await waitFor(() => expect(screen.getByText("Curso DEMO 010")).toBeDefined());

        const patronesRojos = [
            /\bbg-red-/,
            /\btext-red-/,
            /\bborder-red-/,
            /\bring-red-/,
            /\bfrom-red-/,
            /\bto-red-/,
            /\bhover:bg-red-/,
        ];

        for (const el of container.querySelectorAll("*")) {
            const cls = el.className;
            const className = typeof cls === "string" ? cls : (cls as SVGAnimatedString | undefined)?.baseVal ?? "";
            for (const patron of patronesRojos) {
                expect(className, `elemento con clase roja: ${className}`).not.toMatch(patron);
            }
            const inline = (el as HTMLElement).getAttribute("style") ?? "";
            expect(inline.toLowerCase(), `elemento con rgb(185,28,28) inline: ${inline}`).not.toMatch(
                /rgb\s*\(\s*185\s*,\s*28\s*,\s*28\s*\)/
            );
        }
        // Y evidencia positiva: el botón "Desactivar" existe (no fue eliminado
        // por accidente al quitar el rojo) y ya no tiene la clase `bg-red-*`.
        const btn = screen.getByRole("button", { name: "Desactivar" });
        expect(btn.className).not.toMatch(/red-/);
    });

    it("Activar llama al PATCH de estado con 'activo' y recarga la lista", async () => {
        const fetchMock = vi.fn().mockImplementation((url: string, opts?: { method?: string; body?: string }) => {
            if (opts?.method === "PATCH") {
                return Promise.resolve({ ok: true, status: 200, json: async () => ({ curso: { ...CURSOS_TODOS[1], estado: "activo" } }) });
            }
            const items = url.includes("incluirInactivos=true") ? CURSOS_TODOS : CURSOS_ACTIVOS;
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ cursos: items }) });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<CursosPageClient />);
        fireEvent.click(await screen.findByLabelText("Mostrar desactivados"));
        const botonActivar = await screen.findByRole("button", { name: "Activar" });
        fireEvent.click(botonActivar);

        await waitFor(() => {
            const llamo = fetchMock.mock.calls.some(
                (c) => String(c[0]).includes("/api/colegio/cursos/c2/estado") && (c[1] as { method?: string })?.method === "PATCH"
            );
            expect(llamo).toBe(true);
        });
        const patch = fetchMock.mock.calls.find((c) => (c[1] as { method?: string })?.method === "PATCH");
        expect((patch![1] as { body: string }).body).toBe(JSON.stringify("activo"));
    });
});
