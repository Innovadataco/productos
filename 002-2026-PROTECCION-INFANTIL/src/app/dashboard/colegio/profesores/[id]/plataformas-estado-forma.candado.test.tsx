/**
 * CANDADO · SPEC-874 (I-415 · FORMA) · el estado de carga del catálogo de plataformas (modal «Agregar
 * identificador», área COLEGIO · voz «usted»). Recorrido real del componente (mock de fetch + abrir el modal):
 *
 *  §1  Falla TRANSITORIA (el fetch de /api/plataformas rechaza) → caja ÁMBAR operativa (NUNCA rubí · D-120),
 *      copy «No pudimos cargar las plataformas. Suele ser temporal.» (usted, sin «reintenta»), y «Reintentar»
 *      SE QUEDA (acá reintentar es la acción correcta).
 *  §2  200 con lista VACÍA → estado NEUTRO «No hay plataformas disponibles en este momento.», SIN «Reintentar»
 *      (reintentar un 200 vacío no cambia nada — la salida es de operación: sembrar el catálogo) y SIN «Cargando…».
 *
 * El discriminante «reintentar ↔ no reintentar» por el ENDPOINT (sin rama 4xx de precondición) lo fija el
 * candado hermano `src/app/api/plataformas/plataformas-sin-precondicion.candado.test.ts`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// El componente usa `useRouter()`; en jsdom no hay app-router montado.
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

import ProfesorDetallePageClient from "./ProfesorDetallePageClient";

const PROFESOR = { id: "prof-1", nombre: "Ana", apellidos: "Gómez", email: null, telefono: null, estado: "activo" };

/** Mock de fetch URL-aware: el profesor y sus identificadores responden OK; /api/plataformas lo decide el test. */
function stubFetch(plataformas: () => Promise<Response> | Response) {
    vi.stubGlobal("fetch", vi.fn((url: string | URL) => {
        const u = String(url);
        if (u.includes("/api/plataformas")) return Promise.resolve(plataformas());
        if (u.includes("/identificadores")) return Promise.resolve(ok({ identificadores: [] }));
        if (u.includes("/api/colegio/profesores/")) return Promise.resolve(ok({ profesor: PROFESOR }));
        return Promise.resolve(ok({}));
    }));
}
function ok(body: unknown): Response {
    return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

async function abrirModal() {
    render(<ProfesorDetallePageClient params={Promise.resolve({ id: "prof-1" })} />);
    const abrir = await screen.findByRole("button", { name: /Agregar identificador/ });
    fireEvent.click(abrir);
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("SPEC-874 · estado de carga de plataformas (colegio · usted)", () => {
    it("§1 falla transitoria → ÁMBAR (nunca rubí), copy «usted», «Reintentar» se queda", async () => {
        stubFetch(() => Promise.reject(new Error("red")));
        await abrirModal();

        const aviso = await screen.findByText("No pudimos cargar las plataformas. Suele ser temporal.");
        const caja = aviso.closest("div")!;
        expect(caja.className, "la caja de error es ÁMBAR").toContain("bg-ambar");
        expect(caja.className, "D-120: NUNCA rubí para una falla operativa").not.toContain("rubi");
        expect(screen.getByRole("button", { name: /Reintentar/ }), "reintentar se queda").toBeTruthy();
        // Voz vieja «reintenta» (tú) y copy viejo NO deben quedar.
        expect(screen.queryByText(/reintenta\b/i)).toBeNull();
        expect(screen.queryByText(/No se pudieron cargar/)).toBeNull();
    });

    it("§2 200 con lista vacía → estado NEUTRO, SIN «Reintentar» ni «Cargando…»", async () => {
        stubFetch(() => ok({ plataformas: [] }));
        await abrirModal();

        expect(await screen.findByText("No hay plataformas disponibles en este momento.")).toBeTruthy();
        await waitFor(() => {
            expect(screen.queryByRole("button", { name: /Reintentar/ }), "un 200 vacío NO ofrece reintentar").toBeNull();
        });
        expect(screen.queryByText(/Cargando plataformas/), "ya respondió: no es «cargando»").toBeNull();
        // Y no es un error: sin caja ámbar/rubí.
        expect(screen.queryByText("No pudimos cargar las plataformas. Suele ser temporal.")).toBeNull();
    });
});
