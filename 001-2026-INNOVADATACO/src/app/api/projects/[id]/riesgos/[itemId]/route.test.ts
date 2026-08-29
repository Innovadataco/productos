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
import { PATCH, DELETE } from "./route";

/**
 * Aislamiento entre proyectos (spec 014, FR-004).
 *
 * Todas las colecciones de riesgos cuelgan de `/api/projects/[id]/...`. Si el manejador
 * no comprobara que el elemento **pertenece** al proyecto de la URL, esa ruta
 * padre sería decorativa y cualquiera podría editar lo de otro proyecto entrando
 * por la puerta equivocada. Se prueba aquí sobre riesgos; las demás
 * colecciones usan exactamente el mismo manejador generado.
 */

const url = "http://localhost:5001/api/projects/p1/riesgos/r1";
const params = { params: Promise.resolve({ id: "p1", itemId: "r1" }) };

const PARTIDA = {
  id: "r1",
  proyectoId: "p1",
  descripcion: "Retraso",
  probabilidad: "alta",
  impacto: "alto",
  mitigacion: "Plan B",
  estado: "abierto",
};

beforeEach(async () => {
  await conSesion();
  vi.mocked(prisma.riesgoProyecto.findUnique).mockReset();
  vi.mocked(prisma.riesgoProyecto.update).mockReset();
  vi.mocked(prisma.riesgoProyecto.delete).mockReset();
});

describe("PATCH riesgo — pertenencia al proyecto de la ruta", () => {
  it("rechaza con 401 sin sesión, sin tocar la base", async () => {
    await sinSesion();

    const res = await PATCH(peticionJson(url, { estado: "mitigado" }, "PATCH"), params);

    expect(res.status).toBe(401);
    expect(prisma.riesgoProyecto.findUnique).not.toHaveBeenCalled();
  });

  it("responde 404 si la riesgo es de OTRO proyecto: la ruta padre no es decorativa", async () => {
    vi.mocked(prisma.riesgoProyecto.findUnique).mockResolvedValue({
      ...PARTIDA,
      proyectoId: "otro-proyecto",
    } as never);

    const res = await PATCH(peticionJson(url, { estado: "mitigado" }, "PATCH"), params);

    expect(res.status).toBe(404);
    expect(prisma.riesgoProyecto.update).not.toHaveBeenCalled();
  });

  it("actualiza el estado y lo persiste", async () => {
    vi.mocked(prisma.riesgoProyecto.findUnique).mockResolvedValue(PARTIDA as never);
    vi.mocked(prisma.riesgoProyecto.update).mockResolvedValue({
      ...PARTIDA,
      estado: "mitigado",
    } as never);

    const res = await PATCH(peticionJson(url, { estado: "mitigado" }, "PATCH"), params);

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.riesgoProyecto.update).mock.calls[0][0].data).toMatchObject({
      descripcion: "Retraso",
      estado: "mitigado",
    });
  });

  it("valida el RESULTADO: un parcial no puede dejar el riesgo inválido", async () => {
    vi.mocked(prisma.riesgoProyecto.findUnique).mockResolvedValue(PARTIDA as never);

    const res = await PATCH(peticionJson(url, { probabilidad: "imposible" }, "PATCH"), params);

    expect(res.status).toBe(400);
    expect(prisma.riesgoProyecto.update).not.toHaveBeenCalled();
  });
});

describe("DELETE riesgo", () => {
  it("responde 404 si es de otro proyecto y no borra nada", async () => {
    vi.mocked(prisma.riesgoProyecto.findUnique).mockResolvedValue({
      ...PARTIDA,
      proyectoId: "otro-proyecto",
    } as never);

    const res = await DELETE(new NextRequest(url), params);

    expect(res.status).toBe(404);
    expect(prisma.riesgoProyecto.delete).not.toHaveBeenCalled();
  });

  it("elimina la riesgo del proyecto correcto", async () => {
    vi.mocked(prisma.riesgoProyecto.findUnique).mockResolvedValue(PARTIDA as never);
    vi.mocked(prisma.riesgoProyecto.delete).mockResolvedValue(PARTIDA as never);

    const res = await DELETE(new NextRequest(url), params);

    expect(res.status).toBe(200);
    expect(prisma.riesgoProyecto.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
  });
});
