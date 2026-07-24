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
import { PATCH, DELETE } from "./route";

const url = "http://localhost:5001/api/projects/p1/entregables/e1";
const params = { params: Promise.resolve({ id: "p1", entregableId: "e1" }) };
const req = () => new NextRequest(url);

const ENTREGABLE = {
  id: "e1",
  proyectoId: "p1",
  nombre: "Informe final",
  descripcion: "Documento de cierre",
  avance: 50,
  estado: "en curso",
  fechaCompromiso: null,
  responsable: "Ana",
};

beforeEach(async () => {
  await conSesion();
  vi.mocked(prisma.entregable.findUnique).mockReset();
  vi.mocked(prisma.entregable.update).mockReset();
  vi.mocked(prisma.entregable.delete).mockReset();
  vi.mocked(auditLog).mockReset();
});

describe("PATCH /api/projects/[id]/entregables/[entregableId] (spec 008, US3-2)", () => {
  it("rechaza con 401 sin sesión, sin tocar la base", async () => {
    await sinSesion();

    const res = await PATCH(peticionJson(url, { avance: 80 }, "PATCH"), params);

    expect(res.status).toBe(401);
    expect(prisma.entregable.findUnique).not.toHaveBeenCalled();
    expect(prisma.entregable.update).not.toHaveBeenCalled();
  });

  it("responde 404 si el entregable no existe", async () => {
    vi.mocked(prisma.entregable.findUnique).mockResolvedValue(null);

    const res = await PATCH(peticionJson(url, { avance: 80 }, "PATCH"), params);

    expect(res.status).toBe(404);
    expect(prisma.entregable.update).not.toHaveBeenCalled();
  });

  it("responde 404 si el entregable es de OTRO proyecto: la ruta padre no es decorativa", async () => {
    vi.mocked(prisma.entregable.findUnique).mockResolvedValue({
      ...ENTREGABLE,
      proyectoId: "otro-proyecto",
    } as never);

    const res = await PATCH(peticionJson(url, { avance: 80 }, "PATCH"), params);

    expect(res.status).toBe(404);
    expect(prisma.entregable.update).not.toHaveBeenCalled();
  });

  it("actualiza el avance y lo persiste (US3-2)", async () => {
    vi.mocked(prisma.entregable.findUnique).mockResolvedValue(ENTREGABLE as never);
    vi.mocked(prisma.entregable.update).mockResolvedValue({
      ...ENTREGABLE,
      avance: 80,
    } as never);

    const res = await PATCH(peticionJson(url, { avance: 80 }, "PATCH"), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.avance).toBe(80);
    expect(vi.mocked(prisma.entregable.update).mock.calls[0][0].data).toMatchObject({
      nombre: "Informe final",
      avance: 80,
    });
  });

  it("valida el RESULTADO del cambio: un PATCH parcial no puede dejarlo inválido", async () => {
    vi.mocked(prisma.entregable.findUnique).mockResolvedValue(ENTREGABLE as never);

    const res = await PATCH(peticionJson(url, { nombre: "" }, "PATCH"), params);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "El nombre del entregable es obligatorio",
    });
    expect(prisma.entregable.update).not.toHaveBeenCalled();
  });

  it("deja registro en auditoría al editar", async () => {
    vi.mocked(prisma.entregable.findUnique).mockResolvedValue(ENTREGABLE as never);
    vi.mocked(prisma.entregable.update).mockResolvedValue(ENTREGABLE as never);

    await PATCH(peticionJson(url, { avance: 80 }, "PATCH"), params);

    expect(vi.mocked(auditLog).mock.calls[0][0]).toMatchObject({
      action: "proyecto.entregable.editado",
      entityId: "e1",
    });
  });
});

describe("DELETE /api/projects/[id]/entregables/[entregableId] (spec 008, US3)", () => {
  it("rechaza con 401 sin sesión y no borra nada", async () => {
    await sinSesion();

    const res = await DELETE(req(), params);

    expect(res.status).toBe(401);
    expect(prisma.entregable.delete).not.toHaveBeenCalled();
  });

  it("responde 404 si no existe", async () => {
    vi.mocked(prisma.entregable.findUnique).mockResolvedValue(null);

    const res = await DELETE(req(), params);

    expect(res.status).toBe(404);
    expect(prisma.entregable.delete).not.toHaveBeenCalled();
  });

  it("elimina el entregable y lo audita", async () => {
    vi.mocked(prisma.entregable.findUnique).mockResolvedValue(ENTREGABLE as never);
    vi.mocked(prisma.entregable.delete).mockResolvedValue(ENTREGABLE as never);

    const res = await DELETE(req(), params);

    expect(res.status).toBe(200);
    expect(prisma.entregable.delete).toHaveBeenCalledWith({ where: { id: "e1" } });
    expect(vi.mocked(auditLog).mock.calls[0][0]).toMatchObject({
      action: "proyecto.entregable.eliminado",
    });
  });
});
