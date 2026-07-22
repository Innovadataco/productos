import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { IaModelSelector } from "./IaModelSelector";

const MODELS = {
    models: [
        { name: "ornith", tag: "9b", size: 5_000_000_000, modifiedAt: "2026-07-01", esEmbedding: false },
        { name: "nomic-embed-text", tag: "latest", size: 300_000_000, modifiedAt: "2026-07-01", esEmbedding: true },
    ],
};

function mockFetchByUrl(params: Record<string, { ok: boolean; body: unknown }>) {
    return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url === "/api/admin/ia/modelos") {
            return { ok: true, status: 200, json: async () => MODELS } as Response;
        }
        const match = url.match(/^\/api\/config\/parametros\/(.+)$/);
        if (match) {
            const clave = decodeURIComponent(match[1]);
            const entry = params[clave];
            if (!entry || !entry.ok) {
                return { ok: false, status: 404, json: async () => ({ error: { message: "Parámetro no encontrado" } }) } as Response;
            }
            return { ok: true, status: 200, json: async () => entry.body } as Response;
        }
        throw new Error(`fetch no mockeado: ${url}`);
    });
}

describe("IaModelSelector", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("I-05: carga la URL de Ollama por clave y habilita Guardar URL", async () => {
        const fetchSpy = mockFetchByUrl({
            "reportes.classification_model": { ok: true, body: { clave: "reportes.classification_model", valor: "ornith:9b" } },
            "system.ollama_base_url": { ok: true, body: { clave: "system.ollama_base_url", valor: "http://localhost:11434" } },
        });

        render(<IaModelSelector />);

        const urlInput = (await screen.findByLabelText("URL base de Ollama")) as HTMLInputElement;
        await waitFor(() => expect(urlInput.value).toBe("http://localhost:11434"));

        const guardar = screen.getByRole("button", { name: "Guardar URL" }) as HTMLButtonElement;
        expect(guardar.disabled).toBe(false);

        // Regresión I-05: NO se usa la lista paginada; se pide cada parámetro por su clave.
        const llamadas = fetchSpy.mock.calls.map((c) => {
            const input = c[0];
            return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        });
        expect(llamadas).toContain("/api/config/parametros/system.ollama_base_url");
        expect(llamadas).toContain("/api/config/parametros/reportes.classification_model");
        expect(llamadas).not.toContain("/api/config/parametros");
    });

    it("carga el modelo de clasificación activo por clave", async () => {
        mockFetchByUrl({
            "reportes.classification_model": { ok: true, body: { clave: "reportes.classification_model", valor: "ornith:9b" } },
            "system.ollama_base_url": { ok: true, body: { clave: "system.ollama_base_url", valor: "http://localhost:11434" } },
        });

        render(<IaModelSelector />);

        const select = (await screen.findByLabelText("Modelo activo")) as HTMLSelectElement;
        await waitFor(() => expect(select.value).toBe("ornith:9b"));
        expect(await screen.findByText("nomic-embed-text:latest")).toBeTruthy();
    });

    it("tolera 404 de una clave: campo vacío, botón disabled, sin mensaje de error", async () => {
        mockFetchByUrl({
            "reportes.classification_model": { ok: true, body: { clave: "reportes.classification_model", valor: "ornith:9b" } },
            "system.ollama_base_url": { ok: false, body: {} },
        });

        render(<IaModelSelector />);

        const urlInput = (await screen.findByLabelText("URL base de Ollama")) as HTMLInputElement;
        await waitFor(() => expect((screen.getByLabelText("Modelo activo") as HTMLSelectElement).value).toBe("ornith:9b"));
        expect(urlInput.value).toBe("");
        expect((screen.getByRole("button", { name: "Guardar URL" }) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.queryByText("Error cargando parámetros")).toBeNull();
    });
});
