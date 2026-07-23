import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
// Sin inferencia real (ADR_002): el cliente de modelos se mockea.
vi.mock("@/lib/modelClients", () => ({ testModel: vi.fn() }));

vi.mock("@/lib/auth", async () => {
  const { createAuthMock } = await import("@/test/authMock");
  return createAuthMock();
});

import { prisma } from "@/lib/prisma";
import { testModel } from "@/lib/modelClients";
import { conSesion, sinSesion, peticionJson } from "@/test/authMock";
import { POST } from "./route";

const url = "http://localhost:5001/api/config/models/test";

describe("POST /api/config/models/test", () => {
  beforeEach(async () => {
    vi.mocked(prisma.aiModel.findUnique).mockReset();
    vi.mocked(testModel).mockReset();
    await conSesion();
  });

  it("rechaza con 401 sin sesión, sin disparar inferencia (spec 005, FR-003)", async () => {
    await sinSesion();

    const res = await POST(peticionJson(url, { id: "m1" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    expect(prisma.aiModel.findUnique).not.toHaveBeenCalled();
    expect(testModel).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si falta el id", async () => {
    const res = await POST(peticionJson(url, {}));

    expect(res.status).toBe(400);
    expect(testModel).not.toHaveBeenCalled();
  });

  it("responde 404 si el modelo no existe", async () => {
    vi.mocked(prisma.aiModel.findUnique).mockResolvedValue(null);

    const res = await POST(peticionJson(url, { id: "inexistente" }));

    expect(res.status).toBe(404);
    expect(testModel).not.toHaveBeenCalled();
  });

  it("devuelve el resultado de la prueba del modelo", async () => {
    vi.mocked(prisma.aiModel.findUnique).mockResolvedValue({ id: "m1", name: "Qwen" } as never);
    vi.mocked(testModel).mockResolvedValue({
      ok: true,
      text: "respuesta",
      latencyMs: 120,
    });

    const res = await POST(peticionJson(url, { id: "m1" }));
    const body = (await res.json()) as { ok: boolean; latencyMs: number };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.latencyMs).toBe(120);
  });

  it("no filtra el mensaje de excepción al cliente y conserva latencyMs/text (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.aiModel.findUnique).mockRejectedValue(
      new Error("conexión perdida con 10.0.0.1"),
    );

    const res = await POST(peticionJson(url, { id: "m1" }));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body.error).toBe("Error probando el modelo");
    expect(body.ok).toBe(false);
    expect(body).toHaveProperty("latencyMs");
    expect(JSON.stringify(body)).not.toContain("10.0.0.1");
  });
});
