import { describe, it, expect, afterEach, vi } from "vitest";
import { testModel, callModel, resolveOllamaBaseUrl, embedText, EMBEDDING_DIMS } from "./modelClients";

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

describe("embedText (spec 003, FR-003, FR-007)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const modelo = { provider: "ollama", modelPath: "nomic-embed-text", baseUrl: "http://ollama:11434", config: "{}" };

  it("llama a /api/embeddings con la URL resuelta y devuelve el vector de 768", async () => {
    const vec = Array.from({ length: EMBEDDING_DIMS }, () => 0.01);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ embedding: vec }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await embedText(modelo, "texto a vectorizar");

    expect(r.ok).toBe(true);
    expect(r.embedding).toHaveLength(EMBEDDING_DIMS);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://ollama:11434/api/embeddings",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ model: "nomic-embed-text", prompt: "texto a vectorizar" });
  });

  it("rechaza un vector que no mide 768 dimensiones (FR-007), sin corromper la tabla", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ embedding: [0.1, 0.2, 0.3] }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await embedText(modelo, "texto");

    expect(r.ok).toBe(false);
    expect(r.embedding).toEqual([]);
    expect(r.error).toContain("768");
  });

  it("devuelve error legible ante un fallo de red, sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.9")));

    const r = await embedText(modelo, "texto");

    expect(r.ok).toBe(false);
    expect(r.embedding).toEqual([]);
    expect(r.error).toContain("ECONNREFUSED");
  });

  it("propaga el estado de error de Ollama (502-like) sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("modelo no encontrado", { status: 404 })));

    const r = await embedText(modelo, "texto");

    expect(r.ok).toBe(false);
    expect(r.error).toContain("404");
  });
});
