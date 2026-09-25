/**
 * CANDADO · SPEC-728 · El PRIMER registro (`/camino/hijos`) es alta fácil: NO ofrece gestión de
 * vigilancia (pausar/reanudar una cuenta, inactivar al hijo). Pausar/reanudar y la gestión fina
 * viven después en «A quién protejo» / Mi perfil.
 *
 * Conducta (no fuente): se renderiza el árbol real de la pantalla y se afirma:
 *  1. En `variante="alta"` (lo que usa `/camino/hijos`) NO se renderiza ningún «Pausar/Reanudar la
 *     vigilancia» ni «Inactivar»; SÍ quedan «Editar» (corregir) y «Quitarla de mi lista» (sacar un
 *     error) — el alta permite agregar, corregir y sacar, no gestionar la vigilancia.
 *  2. CONTROL POSITIVO: en `variante="gestion"` (el default de «A quién protejo»/Mi perfil) SÍ
 *     aparece «Pausar la vigilancia» — así, si el alta dejara de ocultarlo, (1) se pondría rojo.
 *  3. La pantalla real `/camino/hijos` (CaminoHijosClient) no renderiza ese control.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MisHijos } from "./MisHijos";
import { CaminoHijosClient } from "@/app/camino/hijos/CaminoHijosClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const fetchMock = vi.fn();
beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => cleanup());

function jsonRes(body: unknown, ok = true) {
    return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

const HIJO = {
    id: "h1",
    nombre: "Juan",
    apellidos: "Pérez",
    anioNacimiento: 2015,
    sexo: "M",
    estado: "activo",
    identificadores: [{ id: "i1", valor: "robloxjuan", tipo: null, activo: true, plataforma: null }],
};

function mockRutas() {
    fetchMock.mockImplementation((url: string) => {
        if (String(url).includes("/api/plataformas")) return jsonRes({ plataformas: [] });
        if (String(url).includes("/api/padre/hijos")) return jsonRes([HIJO]);
        return jsonRes({ ok: true });
    });
}

const RE_VIGILANCIA = /(Pausar|Reanudar) la vigilancia/;

describe("SPEC-728 · alta simple del primer registro (sin gestión de vigilancia)", () => {
    it("variante «alta»: NO hay «Pausar/Reanudar la vigilancia» ni «Inactivar»; sí «Editar» y «Quitarla de mi lista»", async () => {
        mockRutas();
        render(<MisHijos variante="alta" />);
        await screen.findByText(/robloxjuan/);
        expect(screen.queryByText(RE_VIGILANCIA), "el alta no ofrece pausar/reanudar la vigilancia (SPEC-728)").toBeNull();
        expect(screen.queryByRole("button", { name: /Inactivar|Activar/ }), "el alta no inactiva al hijo").toBeNull();
        // Lo que SÍ queda: corregir y sacar un error.
        expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
        expect(screen.getByText("Quitarla de mi lista")).toBeTruthy();
    });

    it("CONTROL POSITIVO · variante «gestion» (default) SÍ ofrece «Pausar la vigilancia»", async () => {
        mockRutas();
        render(<MisHijos />);
        await screen.findByText(/robloxjuan/);
        expect(screen.getByText(RE_VIGILANCIA), "en gestión sí existe el control — si no, el candado del alta no probaría nada").toBeTruthy();
    });

    it("CANDADO · `/camino/hijos` (CaminoHijosClient) no renderiza ningún «Pausar/Reanudar la vigilancia»", async () => {
        mockRutas();
        render(<CaminoHijosClient maximoActivos={5} />);
        await screen.findByText(/robloxjuan/);
        expect(screen.queryByText(RE_VIGILANCIA)).toBeNull();
    });
});
