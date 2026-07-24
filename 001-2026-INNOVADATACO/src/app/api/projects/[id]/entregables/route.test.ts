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
import { auditLog } from "@/lib/audit";
import { conSesion, sinSesion, peticionJson } from "@/test/authMock";
import { GET, POST } from "./route";

const url = "http://localhost:5001/api/projects/p1/entregables";
const params = { params: Promise.resolve({ id: "p1" }) };
const req = () => new NextRequest(url);

const PROYECTO = { id: "p1", codigo: "PRY-001", nombre: "Piloto" };
const ENTREGABLE_VALIDO = {
  nombre: "Informe final",
  descripcion: "Documento de cierre",
  avance: 50,
  estado: "en curso",
  fechaCompromiso: "2026-09-30",
  responsable: "Ana",
};

beforeEach(async () => {
  await conSesion();
  vi.mocked(prisma.proyecto.findUnique).mockReset();
  vi.mocked(prisma.entregable.findMany).mockReset();
  vi.mocked(prisma.entregable.create).mockReset();
  vi.mocked(auditLog).mockReset();
});

describe("GET /api/projects/[id]/entregables (spec 008, US3)", () => {
  it("rechaza con 401 sin sesión, sin tocar la base", async () => {
    await sinSesion();

    const res = await GET(req(), params);

    expect(res.status).toBe(401);
    expect(prisma.entregable.findMany).not.toHaveBeenCalled();
  });

  it("responde 404 si el proyecto no existe", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(null);

    const res = await GET(req(), params);

    expect(res.status).toBe(404);
    expect(prisma.entregable.findMany).not.toHaveBeenCalled();
  });

  it("lista los entregables del proyecto, ordenados por fecha de compromiso (SC-006)", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    const fixture = [
      { id: "e1", nombre: "Acta de inicio" },
      { id: "e2", nombre: "Informe final" },
    ];
    vi.mocked(prisma.entregable.findMany).mockResolvedValue(fixture as never);

    const res = await GET(req(), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
    const args = vi.mocked(prisma.entregable.findMany).mock.calls[0][0];
    expect(args?.where).toEqual({ proyectoId: "p1" });
  });
});

describe("POST /api/projects/[id]/entregables (spec 008, FR-009)", () => {
  it("rechaza con 401 sin sesión y no crea nada", async () => {
    await sinSesion();

    const res = await POST(peticionJson(url, ENTREGABLE_VALIDO), params);

    expect(res.status).toBe(401);
    expect(prisma.entregable.create).not.toHaveBeenCalled();
  });

  it("responde 404 si el proyecto no existe", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(null);

    const res = await POST(peticionJson(url, ENTREGABLE_VALIDO), params);

    expect(res.status).toBe(404);
    expect(prisma.entregable.create).not.toHaveBeenCalled();
  });

  it("crea el entregable con sus cinco campos y responde 201 (SC-006)", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.entregable.create).mockResolvedValue({
      id: "e1",
      nombre: "Informe final",
      avance: 50,
      estado: "en curso",
    } as never);

    const res = await POST(peticionJson(url, ENTREGABLE_VALIDO), params);

    expect(res.status).toBe(201);
    const { data } = vi.mocked(prisma.entregable.create).mock.calls[0][0];
    expect(data).toMatchObject({
      proyectoId: "p1",
      nombre: "Informe final",
      descripcion: "Documento de cierre",
      avance: 50,
      estado: "en curso",
      responsable: "Ana",
    });
    expect(data.fechaCompromiso).toBeInstanceOf(Date);
  });

  it("rechaza con 400 un entregable sin nombre, con mensaje legible (US3-3)", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);

    const res = await POST(peticionJson(url, { descripcion: "Sin nombre" }), params);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "El nombre del entregable es obligatorio",
    });
    expect(prisma.entregable.create).not.toHaveBeenCalled();
  });

  it("rechaza con 400 un avance fuera de rango", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);

    const res = await POST(peticionJson(url, { nombre: "X", avance: 500 }), params);

    expect(res.status).toBe(400);
    expect(prisma.entregable.create).not.toHaveBeenCalled();
  });

  it("deja registro en auditoría al crear", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.entregable.create).mockResolvedValue({
      id: "e1",
      nombre: "Informe final",
    } as never);

    await POST(peticionJson(url, ENTREGABLE_VALIDO), params);

    expect(vi.mocked(auditLog).mock.calls[0][0]).toMatchObject({
      action: "proyecto.entregable.creado",
      entityType: "Entregable",
      entityId: "e1",
    });
  });

  it("no filtra el mensaje de excepción al cliente (§0.3)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.proyecto.findUnique).mockRejectedValue(
      new Error("connection refused en 10.0.0.5:5435"),
    );

    const res = await POST(peticionJson(url, ENTREGABLE_VALIDO), params);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error creando entregable" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
