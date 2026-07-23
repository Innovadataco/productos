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

import { prisma } from "@/lib/prisma";
import { conSesion, sinSesion, peticionJson } from "@/test/authMock";
import { GET, PATCH, DELETE } from "./route";

const params = { params: Promise.resolve({ id: "lic1" }) };
const req = () => new NextRequest("http://localhost:5001/api/licitaciones/lic1");

// Por defecto todos los casos corren con sesión válida; los de 401 la quitan.
beforeEach(async () => {
  await conSesion();
});

describe("GET /api/licitaciones/[id]", () => {
  beforeEach(() => {
    vi.mocked(prisma.licitacion.findUnique).mockReset();
  });

  it("devuelve la licitación cuando existe", async () => {
    const fixture = { id: "lic1", numero: "LIC-2026-001" };
    vi.mocked(prisma.licitacion.findUnique).mockResolvedValue(fixture as never);

    const res = await GET(req(), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
  });

  it("responde 404 cuando no existe", async () => {
    vi.mocked(prisma.licitacion.findUnique).mockResolvedValue(null);

    const res = await GET(req(), params);

    expect(res.status).toBe(404);
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.licitacion.findUnique).mockRejectedValue(new Error("timeout en db:5432"));

    const res = await GET(req(), params);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error al obtener licitación" });
    expect(JSON.stringify(body)).not.toContain("db:5432");
  });
});

describe("PATCH /api/licitaciones/[id]", () => {
  beforeEach(() => {
    vi.mocked(prisma.licitacion.findUnique).mockReset();
    vi.mocked(prisma.licitacion.update).mockReset();
  });

  it("rechaza con 401 sin sesión, sin tocar la base (spec 005, FR-002)", async () => {
    await sinSesion();

    const res = await PATCH(
      peticionJson("http://localhost:5001/api/licitaciones/lic1", { titulo: "Nuevo" }, "PATCH"),
      params,
    );

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    expect(prisma.licitacion.findUnique).not.toHaveBeenCalled();
    expect(prisma.licitacion.update).not.toHaveBeenCalled();
  });

  it("responde 404 si la licitación no existe", async () => {
    vi.mocked(prisma.licitacion.findUnique).mockResolvedValue(null);

    const res = await PATCH(
      peticionJson("http://localhost:5001/api/licitaciones/lic1", { titulo: "Nuevo" }, "PATCH"),
      params,
    );

    expect(res.status).toBe(404);
    expect(prisma.licitacion.update).not.toHaveBeenCalled();
  });

  it("actualiza solo los campos enviados y convierte los ids numéricos", async () => {
    vi.mocked(prisma.licitacion.findUnique).mockResolvedValue({ id: "lic1" } as never);
    vi.mocked(prisma.licitacion.update).mockResolvedValue({ id: "lic1", titulo: "Nuevo" } as never);

    const res = await PATCH(
      peticionJson(
        "http://localhost:5001/api/licitaciones/lic1",
        { titulo: "Nuevo", estadoId: "7" },
        "PATCH",
      ),
      params,
    );

    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.licitacion.update).mock.calls[0][0].data;
    expect(data).toEqual({ titulo: "Nuevo", estadoId: 7 });
  });
});

describe("DELETE /api/licitaciones/[id]", () => {
  beforeEach(() => {
    vi.mocked(prisma.licitacion.findUnique).mockReset();
    vi.mocked(prisma.licitacion.delete).mockReset();
  });

  it("rechaza con 401 sin sesión y no borra nada (I-010, FR-002)", async () => {
    await sinSesion();

    const res = await DELETE(req(), params);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    // Antes respondía 404: consultaba la base, o sea que con un id real borraba.
    expect(prisma.licitacion.findUnique).not.toHaveBeenCalled();
    expect(prisma.licitacion.delete).not.toHaveBeenCalled();
  });

  it("responde 404 si no existe", async () => {
    vi.mocked(prisma.licitacion.findUnique).mockResolvedValue(null);

    const res = await DELETE(req(), params);

    expect(res.status).toBe(404);
    expect(prisma.licitacion.delete).not.toHaveBeenCalled();
  });

  it("elimina la licitación existente", async () => {
    vi.mocked(prisma.licitacion.findUnique).mockResolvedValue({ id: "lic1" } as never);
    vi.mocked(prisma.licitacion.delete).mockResolvedValue({ id: "lic1" } as never);

    const res = await DELETE(req(), params);

    expect(res.status).toBe(200);
    expect(prisma.licitacion.delete).toHaveBeenCalledWith({ where: { id: "lic1" } });
  });
});

describe("GET /api/licitaciones/[id] — sesión obligatoria (spec 005, FR-008)", () => {
  it("responde 401 sin sesión y no consulta la base", async () => {
    await sinSesion();
    vi.mocked(prisma.licitacion.findUnique).mockReset();

    const res = await GET(req(), params);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    expect(prisma.licitacion.findUnique).not.toHaveBeenCalled();
  });
});
