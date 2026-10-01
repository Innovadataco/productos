/**
 * CANDADO · SPEC-751 T010 · la PANTALLA de declaración «oír al menor» (forma FORMA-SPEC751-T010, d485493).
 *
 * Conductas que no se pueden fingir (render real + candado de copy):
 *  §1.1  El título NOMBRA al hijo: «Escuchar a {nombre}».
 *  §1.4  Afirmación EXPLÍCITA, NO pre-marcada: la casilla nace sin marcar y «Declarar» está
 *        deshabilitado hasta marcarla (control positivo: marcar → se habilita).
 *  §1.3  El cuerpo de la declaración es [ABOGADO] (placeholder marcado); el copy NUNCA afirma que es
 *        el texto legal final/oficial/definitivo.
 *  real  Declarar llama al endpoint real (`POST /api/audiencia-menor/declarar`) y pasa al estado de
 *        éxito «Listo — gracias por escuchar a {nombre}» + «Continuar».
 *  copy  Sin plazo («rápido»/«minuto»/«hoy»/«en X días»), sin culpa («cuenta incompleta/bloqueada»),
 *        voz tú (sin «usted»/voseo).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { DeclararAudiencia } from "./DeclararAudiencia";

const RUTA = path.resolve(process.cwd(), "src/components/modules/padre/DeclararAudiencia.tsx");
const SRC = fs.readFileSync(RUTA, "utf-8");

function mockFetchOk() {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
}

beforeEach(() => {
    mockFetchOk();
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("SPEC-751 T010 · pantalla de declaración (render)", () => {
    it("§1.1 · el título nombra al hijo", () => {
        render(<DeclararAudiencia menores={[{ hijoId: "h1", nombre: "Ana" }]} continuarHref="/dashboard/padre" />);
        expect(screen.getByRole("heading", { name: "Escuchar a Ana" })).toBeTruthy();
    });

    it("§1.4 · la afirmación NO viene pre-marcada y «Declarar» está deshabilitado hasta marcarla", () => {
        render(<DeclararAudiencia menores={[{ hijoId: "h1", nombre: "Ana" }]} continuarHref="/dashboard/padre" />);
        const casilla = screen.getByRole("checkbox") as HTMLInputElement;
        const declarar = screen.getByRole("button", { name: "Declarar" }) as HTMLButtonElement;

        expect(casilla.checked).toBe(false); // nada consentido de fábrica
        expect(declarar.disabled).toBe(true); // control positivo: deshabilitado sin afirmar

        fireEvent.click(casilla);
        expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
        expect((screen.getByRole("button", { name: "Declarar" }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("§1.3 · el cuerpo de la declaración aparece marcado como [ABOGADO] placeholder", () => {
        render(<DeclararAudiencia menores={[{ hijoId: "h1", nombre: "Ana" }]} continuarHref="/dashboard/padre" />);
        expect(screen.getByText(/\[ABOGADO · cuerpo de la declaración/)).toBeTruthy();
    });

    it("real · declarar llama al endpoint real y pasa al estado de éxito con «Continuar»", async () => {
        render(<DeclararAudiencia menores={[{ hijoId: "h1", nombre: "Ana" }]} continuarHref="/dashboard/padre" />);
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(screen.getByRole("button", { name: "Declarar" }));

        expect(await screen.findByRole("heading", { name: /Listo — gracias por escuchar a Ana/ })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy();

        const llamado = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.some(
            (c) => String(c[0]).includes("/api/audiencia-menor/declarar"),
        );
        expect(llamado).toBe(true);
    });
});

describe("SPEC-751 T010 · copy (fuente)", () => {
    it("§1.3 · no afirma que el placeholder es el texto legal final/oficial/definitivo", () => {
        expect(SRC).toMatch(/\[ABOGADO/);
        expect(SRC).toMatch(/no es el texto final/i);
        expect(SRC).not.toMatch(/declaración oficial|texto (legal )?definitiv/i);
    });

    it("sin plazo y sin culpa", () => {
        expect(SRC).not.toMatch(/\brápido\b|\bun minuto\b|\bhoy mismo\b|\ben \d+ d[ií]as\b/i);
        expect(SRC).not.toMatch(/cuenta (está )?(incompleta|bloqueada)/i);
    });

    it("voz tú — sin usted ni voseo", () => {
        expect(SRC).not.toMatch(/\busted\b/i);
        // Voseo imperativo típico (declará/marcá/continuá/escuchá) — no debe aparecer.
        expect(SRC).not.toMatch(/\b(declar|marc|continu|escuch)á\b/i);
    });
});
