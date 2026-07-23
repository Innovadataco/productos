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
import { GET, PUT } from "./route";

// Todos los casos corren con sesión válida salvo los de 401 (spec 005, US-3).
beforeEach(async () => {
  await conSesion();
});

const url = "http://localhost:5001/api/config/module-settings";
const AJUSTE_VALIDO = { module: "base_oficial", settingKey: "modelo_analisis", aiModelId: "m1" };

describe("GET /api/config/module-settings", () => {
  beforeEach(() => {
    vi.mocked(prisma.moduleSetting.findMany).mockReset();
  });

  it("devuelve los ajustes de módulo", async () => {
    const fixture = [{ id: "s1", module: "base_oficial", settingKey: "modelo_analisis" }];
    vi.mocked(prisma.moduleSetting.findMany).mockResolvedValue(fixture as never);

    const res = await GET();

    expect(res.status).toBe(200);
    // La ruta envuelve la lista: { settings: [...] }
    await expect(res.json()).resolves.toEqual({ settings: fixture });
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.moduleSetting.findMany).mockRejectedValue(new Error("fallo en 10.0.0.11"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error en la configuración de módulos" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.11");
  });
});

describe("PUT /api/config/module-settings", () => {
  beforeEach(() => {
    vi.mocked(prisma.moduleSetting.upsert).mockReset();
  });

  it("rechaza con 401 si no hay sesión", async () => {
    await sinSesion();

    const res = await PUT(peticionJson(url, AJUSTE_VALIDO, "PUT"));

    expect(res.status).toBe(401);
    expect(prisma.moduleSetting.upsert).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si faltan campos requeridos", async () => {
    await conSesion();

    const res = await PUT(peticionJson(url, { module: "base_oficial" }, "PUT"));

    expect(res.status).toBe(400);
    expect(prisma.moduleSetting.upsert).not.toHaveBeenCalled();
  });

  it("hace upsert del ajuste con la clave compuesta módulo+settingKey", async () => {
    await conSesion();
    vi.mocked(prisma.moduleSetting.upsert).mockResolvedValue({ id: "s1", ...AJUSTE_VALIDO } as never);

    const res = await PUT(peticionJson(url, AJUSTE_VALIDO, "PUT"));

    expect(res.status).toBe(200);
    const args = vi.mocked(prisma.moduleSetting.upsert).mock.calls[0][0];
    expect(args.where).toEqual({
      module_settingKey: { module: "base_oficial", settingKey: "modelo_analisis" },
    });
    expect(args.create).toMatchObject(AJUSTE_VALIDO);
  });
});

describe("GET /api/config/module-settings — sesión obligatoria (spec 005, FR-008)", () => {
  it("responde 401 sin sesión y no consulta la base", async () => {
    await sinSesion();
    vi.mocked(prisma.moduleSetting.findMany).mockReset();

    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    expect(prisma.moduleSetting.findMany).not.toHaveBeenCalled();
  });
});
