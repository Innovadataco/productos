/**
 * SPEC-555 (I-337) · CANDADO: el desplegable de plataforma al registrar hijos NO
 * ofrece «Sin plataforma».
 *
 * «Sin plataforma» confundía al padre (parecía una opción afirmativa de «esto no
 * está en ninguna plataforma») cuando lo que faltaba era «Número telefónico»
 * —ahora sembrado por Datos y servido por /api/plataformas—. Este candado
 * renderiza la CONDUCTA: entre las opciones del select «Plataforma» no puede
 * aparecer «Sin plataforma»; en su lugar hay un prompt neutro, y las plataformas
 * del catálogo entran. Muere si «Sin plataforma» vuelve a la lista.
 *
 * NO afirma la presencia de «Número telefónico»: esa fila es dato SEMBRADO (PR de
 * Datos) y un candado de código que dependa de la semilla daría rojo en cualquier
 * entorno sin sembrar. Acá el catálogo se mockea.
 *
 * Integración (jsdom) por el glob src/**: no toca vitest.unit.includes.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MisHijos } from "./MisHijos";

const fetchMock = vi.fn();
beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

function jsonRes(body: unknown, ok = true) {
    return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

// El catálogo mockeado incluye una plataforma cualquiera para probar que el
// listado del catálogo sí entra; no afirmamos «Número telefónico» (es semilla).
const PLATAFORMAS = [
    { id: "p1", clave: "roblox", nombre: "Roblox" },
    { id: "p2", clave: "whatsapp", nombre: "WhatsApp" },
];

function mockRutas() {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (String(url).includes("/api/plataformas")) return jsonRes({ plataformas: PLATAFORMAS });
        if (String(url) === "/api/padre/hijos" && (!init || !init.method || init.method === "GET")) {
            return jsonRes([]);
        }
        return jsonRes({ ok: true });
    });
}

describe("SPEC-555 · el select de plataforma no ofrece «Sin plataforma»", () => {
    it("entre las opciones NO está «Sin plataforma»", async () => {
        mockRutas();
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("mis-hijos-vacio")).toBeDefined());

        const select = screen.getByLabelText("Plataforma") as HTMLSelectElement;
        const etiquetas = within(select).queryAllByRole("option").map((o) => o.textContent);
        expect(etiquetas).not.toContain("Sin plataforma");
    });

    it("hay un prompt neutro y el catálogo entra en las opciones", async () => {
        mockRutas();
        render(<MisHijos />);
        await waitFor(() => expect(screen.getByTestId("mis-hijos-vacio")).toBeDefined());

        const select = screen.getByLabelText("Plataforma") as HTMLSelectElement;
        const etiquetas = within(select).queryAllByRole("option").map((o) => o.textContent);
        expect(etiquetas).toContain("Elige una plataforma");
        // El catálogo mockeado (no la semilla) alimenta el resto.
        expect(etiquetas).toContain("Roblox");
        expect(etiquetas).toContain("WhatsApp");
    });
});
