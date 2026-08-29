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
 * Aislamiento entre proyectos (spec 008, research D6).
 *
 * Todas las colecciones PM2 cuelgan de `/api/projects/[id]/...`. Si el manejador
 * no comprobara que el elemento **pertenece** al proyecto de la URL, esa ruta
 * padre sería decorativa y cualquiera podría editar lo de otro proyecto entrando
 * por la puerta equivocada. Se prueba aquí sobre partidas; las demás
 * colecciones usan exactamente el mismo manejador generado.
 */

const url = "http://localhost:5001/api/projects/p1/partidas/pa1";
const params = { params: Promise.resolve({ id: "p1", itemId: "pa1" }) };

const PARTIDA = {
  id: "pa1",
  proyectoId: "p1",
  concepto: "Personal",
  montoPlaneado: 1000,
  montoEjecutado: 250,
  moneda: "COP",
};

beforeEach(async () => {
  await conSesion();
  vi.mocked(prisma.partidaProyecto.findUnique).mockReset();
  vi.mocked(prisma.partidaProyecto.update).mockReset();
  vi.mocked(prisma.partidaProyecto.delete).mockReset();
});

describe("PATCH partida — pertenencia al proyecto de la ruta", () => {
  it("rechaza con 401 sin sesión, sin tocar la base", async () => {
    await sinSesion();

    const res = await PATCH(peticionJson(url, { montoEjecutado: 900 }, "PATCH"), params);

    expect(res.status).toBe(401);
    expect(prisma.partidaProyecto.findUnique).not.toHaveBeenCalled();
  });

  it("responde 404 si la partida es de OTRO proyecto: la ruta padre no es decorativa", async () => {
    vi.mocked(prisma.partidaProyecto.findUnique).mockResolvedValue({
      ...PARTIDA,
      proyectoId: "otro-proyecto",
    } as never);

    const res = await PATCH(peticionJson(url, { montoEjecutado: 900 }, "PATCH"), params);

    expect(res.status).toBe(404);
    expect(prisma.partidaProyecto.update).not.toHaveBeenCalled();
  });

  it("actualiza el ejecutado y lo persiste", async () => {
    vi.mocked(prisma.partidaProyecto.findUnique).mockResolvedValue(PARTIDA as never);
    vi.mocked(prisma.partidaProyecto.update).mockResolvedValue({
      ...PARTIDA,
      montoEjecutado: 900,
    } as never);

    const res = await PATCH(peticionJson(url, { montoEjecutado: 900 }, "PATCH"), params);

    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.partidaProyecto.update).mock.calls[0][0].data).toMatchObject({
      concepto: "Personal",
      montoEjecutado: 900,
    });
  });

  it("valida el RESULTADO: un parcial no puede dejar la partida inválida", async () => {
    vi.mocked(prisma.partidaProyecto.findUnique).mockResolvedValue(PARTIDA as never);

    const res = await PATCH(peticionJson(url, { montoEjecutado: -5 }, "PATCH"), params);

    expect(res.status).toBe(400);
    expect(prisma.partidaProyecto.update).not.toHaveBeenCalled();
  });
});

describe("DELETE partida", () => {
  it("responde 404 si es de otro proyecto y no borra nada", async () => {
    vi.mocked(prisma.partidaProyecto.findUnique).mockResolvedValue({
      ...PARTIDA,
      proyectoId: "otro-proyecto",
    } as never);

    const res = await DELETE(new NextRequest(url), params);

    expect(res.status).toBe(404);
    expect(prisma.partidaProyecto.delete).not.toHaveBeenCalled();
  });

  it("elimina la partida del proyecto correcto", async () => {
    vi.mocked(prisma.partidaProyecto.findUnique).mockResolvedValue(PARTIDA as never);
    vi.mocked(prisma.partidaProyecto.delete).mockResolvedValue(PARTIDA as never);

    const res = await DELETE(new NextRequest(url), params);

    expect(res.status).toBe(200);
    expect(prisma.partidaProyecto.delete).toHaveBeenCalledWith({ where: { id: "pa1" } });
  });
});
