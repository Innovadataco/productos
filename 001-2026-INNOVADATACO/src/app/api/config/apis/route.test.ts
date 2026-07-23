import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/auth", async () => {
  const { createAuthMock } = await import("@/test/authMock");
  return createAuthMock();
});

import { prisma } from "@/lib/prisma";
import { conSesion, sinSesion, peticionJson } from "@/test/authMock";
import { GET, POST } from "./route";

const url = "http://localhost:5001/api/config/apis";
const API_VALIDA = {
  key: "list_models",
  name: "Listar modelos",
  module: "configuracion",
  method: "GET",
  path: "/api/config/models",
};

describe("GET /api/config/apis", () => {
  beforeEach(() => {
    vi.mocked(prisma.agentApi.findMany).mockReset();
  });

  it("devuelve el catálogo de APIs", async () => {
    const fixture = [{ id: "api1", key: "list_models" }];
    vi.mocked(prisma.agentApi.findMany).mockResolvedValue(fixture as never);

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.agentApi.findMany).mockRejectedValue(new Error("fallo en 10.0.0.2"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error listando APIs" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.2");
  });
});

describe("POST /api/config/apis", () => {
  beforeEach(() => {
    vi.mocked(prisma.agentApi.create).mockReset();
  });

  it("rechaza con 401 si no hay sesión", async () => {
    await sinSesion();

    const res = await POST(peticionJson(url, API_VALIDA));

    expect(res.status).toBe(401);
    expect(prisma.agentApi.create).not.toHaveBeenCalled();
  });

  it("crea la API y serializa docs a string", async () => {
    await conSesion();
    vi.mocked(prisma.agentApi.create).mockResolvedValue({ id: "api1", ...API_VALIDA } as never);

    const res = await POST(peticionJson(url, { ...API_VALIDA, docs: { params: [] } }));

    expect([200, 201]).toContain(res.status);
    const data = vi.mocked(prisma.agentApi.create).mock.calls[0][0].data;
    expect(data.key).toBe("list_models");
    expect(typeof data.docs).toBe("string");
  });
});
