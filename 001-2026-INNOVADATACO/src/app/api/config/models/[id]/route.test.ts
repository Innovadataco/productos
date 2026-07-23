import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

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
import { PUT, DELETE } from "./route";

const url = "http://localhost:5001/api/config/models/m1";
const params = { params: Promise.resolve({ id: "m1" }) };
const EXISTENTE = {
  id: "m1",
  name: "Qwen",
  provider: "ollama",
  scope: "local",
  baseUrl: null,
  modelPath: "qwen2.5:32b",
  config: "{}",
  active: false,
};

describe("PUT /api/config/models/[id]", () => {
  beforeEach(() => {
    vi.mocked(prisma.aiModel.findUnique).mockReset();
    vi.mocked(prisma.aiModel.update).mockReset();
    vi.mocked(prisma.aiModel.updateMany).mockReset();
  });

  it("rechaza con 401 si no hay sesión", async () => {
    await sinSesion();

    const res = await PUT(peticionJson(url, { name: "Nuevo" }, "PUT"), params);

    expect(res.status).toBe(401);
    expect(prisma.aiModel.update).not.toHaveBeenCalled();
  });

  it("responde 404 si el modelo no existe", async () => {
    await conSesion();
    vi.mocked(prisma.aiModel.findUnique).mockResolvedValue(null);

    const res = await PUT(peticionJson(url, { name: "Nuevo" }, "PUT"), params);

    expect(res.status).toBe(404);
    expect(prisma.aiModel.update).not.toHaveBeenCalled();
  });

  it("al activar un modelo desactiva los demás (solo uno activo)", async () => {
    await conSesion();
    vi.mocked(prisma.aiModel.findUnique).mockResolvedValue(EXISTENTE as never);
    vi.mocked(prisma.aiModel.update).mockResolvedValue({ ...EXISTENTE, active: true } as never);

    const res = await PUT(peticionJson(url, { active: true }, "PUT"), params);

    expect(res.status).toBe(200);
    expect(prisma.aiModel.updateMany).toHaveBeenCalledWith({ data: { active: false } });
  });

  it("conserva los valores existentes en los campos no enviados", async () => {
    await conSesion();
    vi.mocked(prisma.aiModel.findUnique).mockResolvedValue(EXISTENTE as never);
    vi.mocked(prisma.aiModel.update).mockResolvedValue(EXISTENTE as never);

    await PUT(peticionJson(url, { name: "Renombrado" }, "PUT"), params);

    const data = vi.mocked(prisma.aiModel.update).mock.calls[0][0].data;
    expect(data.name).toBe("Renombrado");
    expect(data.provider).toBe("ollama");
    expect(data.modelPath).toBe("qwen2.5:32b");
  });
});

describe("DELETE /api/config/models/[id]", () => {
  beforeEach(() => {
    vi.mocked(prisma.aiModel.delete).mockReset();
  });

  it("rechaza con 401 si no hay sesión", async () => {
    await sinSesion();

    const res = await DELETE(new NextRequest(url, { method: "DELETE" }), params);

    expect(res.status).toBe(401);
    expect(prisma.aiModel.delete).not.toHaveBeenCalled();
  });

  it("elimina el modelo cuando hay sesión", async () => {
    await conSesion();
    vi.mocked(prisma.aiModel.delete).mockResolvedValue(EXISTENTE as never);

    const res = await DELETE(new NextRequest(url, { method: "DELETE" }), params);

    expect(res.status).toBe(200);
    expect(prisma.aiModel.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    await conSesion();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.aiModel.delete).mockRejectedValue(new Error("FK constraint en 10.0.0.5"));

    const res = await DELETE(new NextRequest(url, { method: "DELETE" }), params);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error eliminando modelo" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
