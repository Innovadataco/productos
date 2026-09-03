// tests/unit/ollama-config.test.ts · Guards puros del cliente Ollama
// Producto 006 · BI v2 · Admin IA
// Unitarios puros: sin BD ni red — solo isLocalOllamaUrl (R2) e
// isEmbeddingModel. La URL real de la Mac Studio (100.91.87.86, Tailscale)
// está cubierta como caso de aceptación.

import { afterEach, describe, expect, it, vi } from "vitest";
import { isEmbeddingModel, isLocalOllamaUrl, listOllamaModels } from "@/lib/ai/ollama-config";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("isLocalOllamaUrl (R2: solo localhost · IPs privadas · Tailscale)", () => {
    it.each([
        ["localhost", "http://localhost:11435"],
        ["localhost por https", "https://localhost:11435"],
        ["127.0.0.1", "http://127.0.0.1:11435"],
        ["127.x genérico", "http://127.240.1.2:11435"],
        ["10.x", "http://10.0.0.5:11435"],
        ["172.16 (límite bajo /12)", "http://172.16.0.1:11435"],
        ["172.31 (límite alto /12)", "http://172.31.255.254:11435"],
        ["192.168.x", "http://192.168.1.10:11435"],
        ["100.64 (límite bajo Tailscale /10)", "http://100.64.0.1:11435"],
        ["100.91.87.86 (Mac Studio real del 006)", "http://100.91.87.86:11435"],
        ["100.127 (límite alto Tailscale /10)", "http://100.127.255.255:11435"],
    ])("acepta %s", (_etiqueta, url) => {
        expect(isLocalOllamaUrl(url)).toBe(true);
    });

    it.each([
        ["IP pública (DNS de Google)", "http://8.8.8.8:11435"],
        ["IP pública genérica", "http://190.240.10.5:11435"],
        ["172.15 (fuera de /12 por abajo)", "http://172.15.0.1:11435"],
        ["172.32 (fuera de /12 por arriba)", "http://172.32.0.1:11435"],
        ["100.63 (fuera de Tailscale por abajo)", "http://100.63.255.255:11435"],
        ["100.128 (fuera de Tailscale por arriba)", "http://100.128.0.1:11435"],
        ["hostname público", "http://ollama.example.com:11435"],
        ["hostname inválido (no es URL)", "no-es-una-url"],
        ["cadena vacía", ""],
    ])("rechaza %s", (_etiqueta, url) => {
        expect(isLocalOllamaUrl(url)).toBe(false);
    });
});

describe("isEmbeddingModel", () => {
    it.each([
        ["snowflake-arctic-embed2 (contiene 'embed')", "snowflake-arctic-embed2", true],
        ["nomic-embed-text (default conocido)", "nomic-embed-text", true],
        ["qwen2.5:14b (modelo de chat)", "qwen2.5:14b", false],
        ["llama3.1:8b (modelo de chat)", "llama3.1:8b", false],
    ])("%s → %s", (_etiqueta, nombre, esperado) => {
        expect(isEmbeddingModel(nombre)).toBe(esperado);
    });
});

describe("listOllamaModels · capabilities del servidor (DEFECTO 3, auditoría 2026-09-03)", () => {
    function mockTags(modelos: Array<{ name: string; capabilities?: string[] }>) {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: true,
                json: async () => ({ models: modelos }),
            })) as unknown as typeof fetch,
        );
    }

    it("detecta embeddings SOLO por capabilities — bge-m3 y paraphrase-multilingual quedan fuera del selector", async () => {
        mockTags([
            { name: "qwen2.5:14b", capabilities: ["completion"] },
            { name: "bge-m3:latest", capabilities: ["embedding"] },
            { name: "paraphrase-multilingual:latest", capabilities: ["embedding"] },
            { name: "nomic-embed-text:latest", capabilities: ["embedding"] },
            { name: "snowflake-arctic-embed2:latest", capabilities: ["embedding"] },
            { name: "llama3.1:8b", capabilities: ["completion"] },
        ]);
        const modelos = await listOllamaModels("http://localhost:11435");
        const etiqueta = (m: { name: string; tag: string }): string => `${m.name}:${m.tag}`;
        const deChat = modelos.filter((m) => !m.esEmbedding).map(etiqueta);
        const embeddings = modelos.filter((m) => m.esEmbedding).map(etiqueta);
        // Los 4 embeddings de la Mac se excluyen — los 2 que el nombre no
        // detectaba (bge-m3, paraphrase-multilingual) ahora sí.
        expect(embeddings).toHaveLength(4);
        expect(deChat.sort()).toEqual(["llama3.1:8b", "qwen2.5:14b"]);
    });

    it("fallback por nombre cuando el servidor no reporta capabilities (versiones viejas)", async () => {
        mockTags([
            { name: "qwen2.5:14b" },
            { name: "nomic-embed-text:latest" },
            { name: "bge-m3:latest" }, // el fallback por nombre lo deja pasar: limitación documentada
        ]);
        const modelos = await listOllamaModels("http://localhost:11435");
        expect(modelos.find((m) => m.name === "nomic-embed-text")?.esEmbedding).toBe(true);
        expect(modelos.find((m) => m.name === "qwen2.5")?.esEmbedding).toBe(false);
    });

    it("expone capabilities para que el guard de guardado exija 'completion'", async () => {
        mockTags([
            { name: "qwen2.5:14b", capabilities: ["completion"] },
            { name: "bge-m3:latest", capabilities: ["embedding"] },
        ]);
        const modelos = await listOllamaModels("http://localhost:11435");
        expect(modelos.find((m) => m.name === "qwen2.5")?.capabilities).toContain("completion");
        expect(modelos.find((m) => m.name === "bge-m3")?.capabilities).not.toContain("completion");
    });
});
