import { describe, it, expect } from "vitest";
import { isLocalOllamaUrl, isEmbeddingModel } from "./ollama-config";

describe("isLocalOllamaUrl", () => {
    it("accepts localhost", () => {
        expect(isLocalOllamaUrl("http://localhost:11434")).toBe(true);
        expect(isLocalOllamaUrl("http://localhost:11434/api/tags")).toBe(true);
    });

    it("accepts 127.0.0.1", () => {
        expect(isLocalOllamaUrl("http://127.0.0.1:11434")).toBe(true);
    });

    it("accepts private RFC1918 IPs", () => {
        expect(isLocalOllamaUrl("http://192.168.1.50:11434")).toBe(true);
        expect(isLocalOllamaUrl("http://10.0.0.5:11434")).toBe(true);
        expect(isLocalOllamaUrl("http://172.16.0.1:11434")).toBe(true);
        expect(isLocalOllamaUrl("http://172.31.255.255:11434")).toBe(true);
    });

    it("accepts Tailscale 100.64.0.0/10", () => {
        expect(isLocalOllamaUrl("http://100.100.1.2:11434")).toBe(true);
    });

    it("rejects public IPs and hostnames", () => {
        expect(isLocalOllamaUrl("https://api.openai.com/v1")).toBe(false);
        expect(isLocalOllamaUrl("http://8.8.8.8:11434")).toBe(false);
        expect(isLocalOllamaUrl("http://ollama.example.com:11434")).toBe(false);
    });

    it("rejects malformed URLs", () => {
        expect(isLocalOllamaUrl("not-a-url")).toBe(false);
    });
});

describe("isEmbeddingModel", () => {
    it("detects embedding models", () => {
        expect(isEmbeddingModel("nomic-embed-text")).toBe(true);
        expect(isEmbeddingModel("mxbai-embed-large")).toBe(true);
        expect(isEmbeddingModel("snowflake-arctic-embed")).toBe(true);
    });

    it("returns false for classification models", () => {
        expect(isEmbeddingModel("ornith:9b")).toBe(false);
        expect(isEmbeddingModel("llama3")).toBe(false);
    });
});
