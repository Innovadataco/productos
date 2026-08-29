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

import { prisma } from "@/lib/prisma";
import { conSesion, sinSesion, peticionJson } from "@/test/authMock";
import { GET, POST } from "./route";

const url = "http://localhost:5001/api/projects/p1/lecciones";
const params = { params: Promise.resolve({ id: "p1" }) };
const PROYECTO = { id: "p1", codigo: "PRY-001" };

beforeEach(async () => {
  await conSesion();
  vi.mocked(prisma.proyecto.findUnique).mockReset();
  vi.mocked(prisma.leccionAprendida.findMany).mockReset();
  vi.mocked(prisma.leccionAprendida.create).mockReset();
});

describe("GET /api/projects/[id]/lecciones (spec 008, US6)", () => {
  it("rechaza con 401 sin sesión, sin tocar la base", async () => {
    await sinSesion();

    const res = await GET(new NextRequest(url), params);

    expect(res.status).toBe(401);
    expect(prisma.leccionAprendida.findMany).not.toHaveBeenCalled();
  });

  it("responde 404 si el proyecto no existe", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(null);

    const res = await GET(new NextRequest(url), params);

    expect(res.status).toBe(404);
    expect(prisma.leccionAprendida.findMany).not.toHaveBeenCalled();
  });

  it("lista solo lo del proyecto de la ruta", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.leccionAprendida.findMany).mockResolvedValue([] as never);

    const res = await GET(new NextRequest(url), params);

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.leccionAprendida.findMany).mock.calls[0][0]?.where).toEqual({
      proyectoId: "p1",
    });
  });
});

describe("POST /api/projects/[id]/lecciones (spec 008, US6)", () => {
  it("rechaza con 401 sin sesión y no crea nada", async () => {
    await sinSesion();

    const res = await POST(peticionJson(url, { descripcion: "Estimar con holgura" }), params);

    expect(res.status).toBe(401);
    expect(prisma.leccionAprendida.create).not.toHaveBeenCalled();
  });

  it("crea y responde 201", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.leccionAprendida.create).mockResolvedValue({ id: "x1" } as never);

    const res = await POST(peticionJson(url, { descripcion: "Estimar con holgura" }), params);

    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.leccionAprendida.create).mock.calls[0][0].data).toMatchObject({
      proyectoId: "p1",
    });
  });

  it("rechaza con 400 lo inválido, con mensaje legible", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);

    const res = await POST(peticionJson(url, { categoria: "gestión" }), params);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(prisma.leccionAprendida.create).not.toHaveBeenCalled();
  });

  it("no filtra el mensaje de excepción al cliente (§0.3)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.proyecto.findUnique).mockRejectedValue(new Error("db en 10.0.0.5:5435"));

    const res = await POST(peticionJson(url, { descripcion: "Estimar con holgura" }), params);

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("10.0.0.5");
  });
});
