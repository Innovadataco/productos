import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock de prisma: este test valida la resolución de {baseUrl} (FR-010), no la BD
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentApi: { findUnique: vi.fn(), findFirst: vi.fn() },
    aiModel: { findFirst: vi.fn() },
    documentoOficial: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const baseApi = {
  id: "api-test-1",
  key: "ollama_tags",
  name: "Ollama tags",
  module: "configuracion",
  submodule: "modelos_locales",
  category: "external",
  method: "GET",
  path: "{baseUrl}/api/tags",
  authType: "none",
  active: true,
};

function mockFetchOk() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ models: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function makeReq() {
  return new NextRequest("http://localhost:5001/api/config/apis/api-test-1/test", {
    method: "POST",
  });
}

describe("POST /api/config/apis/[id]/test — resolución de {baseUrl} (FR-010)", () => {
  beforeEach(() => {
    vi.mocked(prisma.agentApi.findUnique).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("config sin baseUrl → usa OLLAMA_BASEURL del entorno", async () => {
    vi.stubEnv("OLLAMA_BASEURL", "http://host.docker.internal:11434");
    vi.mocked(prisma.agentApi.findUnique).mockResolvedValue({ ...baseApi, config: "{}" } as never);
    const fetchMock = mockFetchOk();

    const res = await POST(makeReq(), { params: Promise.resolve({ id: "api-test-1" }) });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://host.docker.internal:11434/api/tags",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("el baseUrl de la config (BD/UI) manda sobre la variable de entorno", async () => {
    vi.stubEnv("OLLAMA_BASEURL", "http://host.docker.internal:11434");
    vi.mocked(prisma.agentApi.findUnique).mockResolvedValue({
      ...baseApi,
      config: JSON.stringify({ baseUrl: "http://gpu-server:11434" }),
    } as never);
    const fetchMock = mockFetchOk();

    const res = await POST(makeReq(), { params: Promise.resolve({ id: "api-test-1" }) });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://gpu-server:11434/api/tags",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("sin config ni entorno cae al default localhost", async () => {
    vi.stubEnv("OLLAMA_BASEURL", "");
    vi.mocked(prisma.agentApi.findUnique).mockResolvedValue({ ...baseApi, config: "{}" } as never);
    const fetchMock = mockFetchOk();

    await POST(makeReq(), { params: Promise.resolve({ id: "api-test-1" }) });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/tags",
      expect.objectContaining({ method: "GET" })
    );
  });
});
