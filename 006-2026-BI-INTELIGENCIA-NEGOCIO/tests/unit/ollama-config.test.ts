// tests/unit/ollama-config.test.ts · Guards puros del cliente Ollama
// Producto 006 · BI v2 · Admin IA
// Unitarios puros: sin BD ni red — solo isLocalOllamaUrl (R2) e
// isEmbeddingModel. La URL real de la Mac Studio (100.91.87.86, Tailscale)
// está cubierta como caso de aceptación.

import { describe, expect, it } from "vitest";
import { isEmbeddingModel, isLocalOllamaUrl } from "@/lib/ai/ollama-config";

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
