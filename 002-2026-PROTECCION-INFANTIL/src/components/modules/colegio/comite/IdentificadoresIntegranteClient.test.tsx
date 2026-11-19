/**
 * SPEC-932 · el comité MIGRA al patrón único: tabla con Plataforma + Editar (antes form inline + `<ul>`, sin
 * Plataforma ni Editar). Edición por PATCH al endpoint del integrante con `{ valor, plataformaId }`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { IdentificadoresIntegranteClient } from "./IdentificadoresIntegranteClient";

const BASE = "/api/colegio/comite/integrantes/int-1/identificadores";
const ITEM = { id: "id-1", tipo: "usuario", valor: "@nick", estado: "activo", plataforma: null, createdAt: "2026-11-01" };

function resp(body: unknown): Response {
    return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("SPEC-932 · comité → patrón único", () => {
    it("tabla con Plataforma + Editar; editar hace PATCH {valor, plataformaId} y el éxito del comité se conserva al agregar", async () => {
        const fetchMock = vi.fn((url: string | URL, init?: RequestInit) => {
            const u = String(url);
            if (u.includes("/api/plataformas")) return Promise.resolve(resp({ plataformas: [{ id: "plat-wa", nombre: "WhatsApp" }] }));
            if (init?.method === "PATCH") return Promise.resolve(resp({ identificador: ITEM }));
            if (init?.method === "POST") return Promise.resolve(resp({ identificador: ITEM }));
            return Promise.resolve(resp({ items: [ITEM] }));
        });
        vi.stubGlobal("fetch", fetchMock);
        render(<IdentificadoresIntegranteClient integranteId="int-1" />);

        expect(await screen.findByRole("columnheader", { name: "Plataforma" })).toBeTruthy();
        expect(screen.getByText("Identificadores del integrante")).toBeTruthy();
        expect(screen.queryByText("Vigilados")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Editar" }));
        await screen.findByText("Editar identificador");
        await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).not.toHaveProperty("disabled", true));
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                `${BASE}/id-1`,
                expect.objectContaining({ method: "PATCH", body: JSON.stringify({ valor: "@nick", plataformaId: null }) }),
            ),
        );

        fireEvent.click(screen.getByRole("button", { name: "Nuevo identificador" }));
        fireEvent.change(await screen.findByPlaceholderText(/Ej\. \+573001234567/), { target: { value: "+573001112233" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByText("Identificador agregado. Desde ahora la cuenta se vigila.")).toBeTruthy();
    });
});
