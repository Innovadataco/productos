import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/auth", async () => {
  const { createAuthMock } = await import("@/test/authMock");
  return createAuthMock();
});
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ encrypt: vi.fn((v: string) => `cifrado:${v}`) }));

import { prisma } from "@/lib/prisma";
import { conSesion, sinSesion, peticionJson } from "@/test/authMock";
import { GET, POST } from "./route";

const url = "http://localhost:5001/api/config/models";
const MODELO_VALIDO = { name: "Qwen Local", provider: "ollama", modelPath: "qwen2.5:32b" };

describe("GET /api/config/models", () => {
  beforeEach(() => {
    vi.mocked(prisma.aiModel.findMany).mockReset();
  });

  it("devuelve los modelos configurados", async () => {
    const fixture = [{ id: "m1", name: "Qwen Local", provider: "ollama" }];
    vi.mocked(prisma.aiModel.findMany).mockResolvedValue(fixture as never);

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
  });

  it("nunca selecciona la apiKey (no debe salir del servidor)", async () => {
    vi.mocked(prisma.aiModel.findMany).mockResolvedValue([] as never);

    await GET();

    const select = vi.mocked(prisma.aiModel.findMany).mock.calls[0][0].select;
    expect(select).not.toHaveProperty("apiKey");
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.aiModel.findMany).mockRejectedValue(new Error("fallo en 10.0.0.6"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error listando modelos" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.6");
  });
});

describe("POST /api/config/models", () => {
  beforeEach(() => {
    vi.mocked(prisma.aiModel.create).mockReset();
  });

  it("rechaza con 401 si no hay sesión", async () => {
    await sinSesion();

    const res = await POST(peticionJson(url, MODELO_VALIDO));

    expect(res.status).toBe(401);
    expect(prisma.aiModel.create).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si faltan campos requeridos", async () => {
    await conSesion();

    const res = await POST(peticionJson(url, { name: "Sin provider ni modelPath" }));

    expect(res.status).toBe(400);
    expect(prisma.aiModel.create).not.toHaveBeenCalled();
  });

  it("crea el modelo y cifra la apiKey antes de guardarla", async () => {
    await conSesion();
    vi.mocked(prisma.aiModel.create).mockResolvedValue({ id: "m1", ...MODELO_VALIDO } as never);

    const res = await POST(peticionJson(url, { ...MODELO_VALIDO, apiKey: "sk-secreta" }));

    expect([200, 201]).toContain(res.status);
    const data = vi.mocked(prisma.aiModel.create).mock.calls[0][0].data;
    expect(data.name).toBe("Qwen Local");
    expect(data.apiKey).not.toBe("sk-secreta");
    expect(String(data.apiKey)).toContain("cifrado:");
  });
});
