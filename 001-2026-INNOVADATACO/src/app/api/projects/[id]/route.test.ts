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
import { conSesion, sinSesion, peticionJson, SESION_FIXTURE } from "@/test/authMock";
import { PATCH, DELETE } from "./route";

const url = "http://localhost:5001/api/projects/p1";
const params = { params: Promise.resolve({ id: "p1" }) };
const req = () => new NextRequest(url);

const PROYECTO = {
  id: "p1",
  codigo: "PRY-001",
  nombre: "Piloto",
  cliente: "IDC",
  estado: "active",
  currentPhase: "initiation",
};

beforeEach(async () => {
  await conSesion();
  vi.mocked(prisma.proyecto.findUnique).mockReset();
  vi.mocked(prisma.proyecto.update).mockReset();
  vi.mocked(prisma.proyecto.delete).mockReset();
  vi.mocked(auditLog).mockReset();
});

describe("PATCH /api/projects/[id] (spec 008, US1)", () => {
  it("rechaza con 401 sin sesión, sin tocar la base", async () => {
    await sinSesion();

    const res = await PATCH(peticionJson(url, { nombre: "Otro" }, "PATCH"), params);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    expect(prisma.proyecto.findUnique).not.toHaveBeenCalled();
    expect(prisma.proyecto.update).not.toHaveBeenCalled();
  });

  it("responde 404 si el proyecto no existe (SC-002)", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(null);

    const res = await PATCH(peticionJson(url, { nombre: "Otro" }, "PATCH"), params);

    expect(res.status).toBe(404);
    expect(prisma.proyecto.update).not.toHaveBeenCalled();
  });

  it("edita nombre y cliente y los persiste (SC-001: antes editar era imposible)", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.proyecto.update).mockResolvedValue({
      ...PROYECTO,
      nombre: "Piloto II",
      cliente: "MinTIC",
    } as never);

    const res = await PATCH(
      peticionJson(url, { nombre: "Piloto II", cliente: "MinTIC" }, "PATCH"),
      params,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nombre).toBe("Piloto II");
    expect(vi.mocked(prisma.proyecto.update).mock.calls[0][0].data).toEqual({
      nombre: "Piloto II",
      cliente: "MinTIC",
    });
  });

  it("responde 409 cuando el código ya lo usa otro proyecto (SC-002)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.proyecto.update).mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const res = await PATCH(peticionJson(url, { codigo: "PRY-002" }, "PATCH"), params);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "Ya existe un proyecto con ese código" });
  });

  it("responde 400 ante una fase que no es PM2: las fases son fijas, no un catálogo abierto", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);

    const res = await PATCH(peticionJson(url, { currentPhase: "fase-inventada" }, "PATCH"), params);

    expect(res.status).toBe(400);
    expect(prisma.proyecto.update).not.toHaveBeenCalled();
  });

  it("responde 400 si el nombre llega vacío", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);

    const res = await PATCH(peticionJson(url, { nombre: "" }, "PATCH"), params);

    expect(res.status).toBe(400);
    expect(prisma.proyecto.update).not.toHaveBeenCalled();
  });

  it("no filtra el mensaje de excepción al cliente (§0.3)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.proyecto.findUnique).mockRejectedValue(
      new Error("connection refused en 10.0.0.5:5435"),
    );

    const res = await PATCH(peticionJson(url, { nombre: "Otro" }, "PATCH"), params);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error actualizando proyecto" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});

describe("PATCH /api/projects/[id] — auditoría del cambio de fase (spec 008, FR-006)", () => {
  const moverFase = async (faseActual: string, faseEnviada: string) => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue({
      ...PROYECTO,
      currentPhase: faseActual,
    } as never);
    vi.mocked(prisma.proyecto.update).mockResolvedValue(PROYECTO as never);

    return PATCH(peticionJson(url, { currentPhase: faseEnviada }, "PATCH"), params);
  };

  it("registra quién movió qué proyecto, de qué fase a cuál (SC-004)", async () => {
    const res = await moverFase("initiation", "planning");

    expect(res.status).toBe(200);
    expect(auditLog).toHaveBeenCalledTimes(1);
    expect(vi.mocked(auditLog).mock.calls[0][0]).toMatchObject({
      action: "proyecto.fase.cambio",
      entityType: "Proyecto",
      entityId: "p1",
      userId: SESION_FIXTURE.sub,
      status: "success",
      metadata: { faseAnterior: "initiation", faseNueva: "planning" },
    });
  });

  it("NO registra cambio de fase si llega la misma que ya tenía (FR-007)", async () => {
    const res = await moverFase("execution", "execution");

    expect(res.status).toBe(200);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("una edición corriente audita como proyecto.editado, no como cambio de fase", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.proyecto.update).mockResolvedValue(PROYECTO as never);

    await PATCH(peticionJson(url, { nombre: "Piloto II" }, "PATCH"), params);

    expect(auditLog).toHaveBeenCalledTimes(1);
    expect(vi.mocked(auditLog).mock.calls[0][0]).toMatchObject({
      action: "proyecto.editado",
      metadata: { campos: ["nombre"] },
    });
  });
});

describe("DELETE /api/projects/[id] (spec 008, FR-002)", () => {
  it("rechaza con 401 sin sesión y no borra nada", async () => {
    await sinSesion();

    const res = await DELETE(req(), params);

    expect(res.status).toBe(401);
    expect(prisma.proyecto.findUnique).not.toHaveBeenCalled();
    expect(prisma.proyecto.delete).not.toHaveBeenCalled();
  });

  it("responde 404 si no existe", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(null);

    const res = await DELETE(req(), params);

    expect(res.status).toBe(404);
    expect(prisma.proyecto.delete).not.toHaveBeenCalled();
  });

  it("elimina el proyecto existente y lo audita", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.proyecto.delete).mockResolvedValue(PROYECTO as never);

    const res = await DELETE(req(), params);

    expect(res.status).toBe(200);
    expect(prisma.proyecto.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(vi.mocked(auditLog).mock.calls[0][0]).toMatchObject({
      action: "proyecto.eliminado",
      entityId: "p1",
    });
  });
});
