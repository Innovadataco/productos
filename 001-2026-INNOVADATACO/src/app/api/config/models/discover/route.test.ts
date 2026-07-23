import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

function mockOllamaTags() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ models: [{ name: "qwen2.5:32b", model: "qwen2.5:32b" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("GET /api/config/models/discover (FR-010)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sin baseUrl en query usa OLLAMA_BASEURL del entorno", async () => {
    vi.stubEnv("OLLAMA_BASEURL", "http://host.docker.internal:11434");
    const fetchMock = mockOllamaTags();

    const req = new NextRequest("http://localhost:5001/api/config/models/discover");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://host.docker.internal:11434/api/tags",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("el baseUrl explícito de la query manda sobre la variable de entorno", async () => {
    vi.stubEnv("OLLAMA_BASEURL", "http://host.docker.internal:11434");
    const fetchMock = mockOllamaTags();

    const req = new NextRequest(
      "http://localhost:5001/api/config/models/discover?baseUrl=http://otro-host:9999"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://otro-host:9999/api/tags",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("no filtra el mensaje de excepción al cliente y conserva models: [] (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 192.168.5.2:11434")),
    );

    const req = new NextRequest("http://localhost:5001/api/config/models/discover");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ error: "No se pudo contactar Ollama", models: [] });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
  });

  it("sin query ni entorno cae al default localhost", async () => {
    vi.stubEnv("OLLAMA_BASEURL", "");
    const fetchMock = mockOllamaTags();

    const req = new NextRequest("http://localhost:5001/api/config/models/discover");
    await GET(req);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/tags",
      expect.objectContaining({ method: "GET" })
    );
  });
});
