/**
 * CANDADO · SPEC-935 — (I-449) tras crear la cuenta del comité el formulario de integrantes aparece SIN recargar;
 * (I-448) el rector no ve el formulario de notas del caso (su POST es 403: control visible que no funciona).
 *
 * I-449: la página `comite/integrantes` (server) muestra `IntegrantesList` solo si la `cuenta` que leyó existe; la
 * tarjeta creaba la cuenta en su estado local y la página no se enteraba → el formulario aparecía solo al recargar.
 * Conducta: crear con éxito → `router.refresh()` (re-render del server); crear con error → NO refresca.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

import { ComiteCuentaCard } from "./ComiteCuentaCard";

const CUENTA = {
    id: "c1",
    email: "comite@colegio.test",
    estado: "activo",
    debeCambiarPassword: true,
    ultimaSesion: null,
    creadoEn: new Date("2026-11-19").toISOString(),
};

function respuesta(ok: boolean, body: unknown): Response {
    return { ok, status: ok ? 201 : 409, json: () => Promise.resolve(body) } as Response;
}

async function crearCon(ok: boolean) {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(respuesta(ok, ok ? { cuenta: CUENTA } : { error: { message: "Ya existe" } }))));
    const { container } = render(<ComiteCuentaCard cuenta={null} />);
    const input = container.querySelector('input[type="email"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "comite@colegio.test" } });
    fireEvent.submit(input.closest("form")!);
}

afterEach(() => {
    cleanup();
    refresh.mockClear();
    vi.unstubAllGlobals();
});

describe("SPEC-935 · I-449 · alta de la cuenta del comité → integrantes sin recargar", () => {
    it("crear con éxito refresca la página (aparece el formulario de integrantes)", async () => {
        await crearCon(true);
        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    });

    it("control: si la creación falla NO refresca (y se ve el error)", async () => {
        await crearCon(false);
        expect(await screen.findByText("Ya existe")).toBeTruthy();
        expect(refresh).not.toHaveBeenCalled();
    });
});

describe("SPEC-935 · I-448 · el rector no ve controles de escritura del caso", () => {
    it("el formulario de notas está detrás de `puedeResolver` (solo comité)", () => {
        const src = fs.readFileSync(path.join(__dirname, "CasoDetalle.tsx"), "utf-8");
        expect(src).toMatch(/\{puedeResolver && \(\s*<form onSubmit=\{agregarNota\}/);
        // Todos los formularios/acciones de escritura están gateados (análisis, recomendación, cierre, notas).
        for (const h of ["guardarAnalisis", "resolver", "agregarNota"]) {
            const i = src.indexOf(`onSubmit={${h}}`);
            expect(i, `${h} no encontrado`).toBeGreaterThan(-1);
            expect(src.slice(Math.max(0, i - 1500), i), `${h} sin gate de puedeResolver`).toMatch(/puedeResolver/);
        }
    });
});
