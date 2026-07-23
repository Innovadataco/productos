import { describe, it, expect, afterEach, vi } from "vitest";
import { testModel, callModel, resolveOllamaBaseUrl } from "./modelClients";

describe("resolveOllamaBaseUrl (FR-010)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("el valor explícito (BD/UI) manda sobre la variable de entorno", () => {
    vi.stubEnv("OLLAMA_BASEURL", "http://host.docker.internal:11434");
    expect(resolveOllamaBaseUrl("http://mi-servidor:9999")).toBe("http://mi-servidor:9999");
  });

  it("sin valor explícito usa OLLAMA_BASEURL del entorno", () => {
    vi.stubEnv("OLLAMA_BASEURL", "http://host.docker.internal:11434");
    expect(resolveOllamaBaseUrl(null)).toBe("http://host.docker.internal:11434");
    expect(resolveOllamaBaseUrl(undefined)).toBe("http://host.docker.internal:11434");
    expect(resolveOllamaBaseUrl("")).toBe("http://host.docker.internal:11434");
  });

  it("sin explícito ni entorno cae al default localhost", () => {
    vi.stubEnv("OLLAMA_BASEURL", "");
    expect(resolveOllamaBaseUrl(null)).toBe("http://localhost:11434");
  });

  it("OLLAMA_BASEURL vacía se trata como no definida (contrato de .env.example)", () => {
    vi.stubEnv("OLLAMA_BASEURL", "");
    expect(resolveOllamaBaseUrl(undefined)).toBe("http://localhost:11434");
  });

  it("recorta la barra final en cualquier origen del valor", () => {
    vi.stubEnv("OLLAMA_BASEURL", "http://host.docker.internal:11434/");
    expect(resolveOllamaBaseUrl(null)).toBe("http://host.docker.internal:11434");
    expect(resolveOllamaBaseUrl("http://x:1/")).toBe("http://x:1");
  });
});

describe("modelClients", () => {
  it("mock provider returns raw text response with exact LLM params", async () => {
    const result = await testModel({ provider: "mock", modelPath: "mock", config: "{}" });
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.rawText).toBe(result.text);
    expect(result.text).toContain("Mock extraído");
  });

  it("unknown provider fails", async () => {
    const result = await callModel({ provider: "x", modelPath: "x", config: "{}" }, "hi");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unknown provider");
  });
});
