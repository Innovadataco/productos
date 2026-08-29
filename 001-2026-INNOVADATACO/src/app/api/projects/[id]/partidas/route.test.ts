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

const url = "http://localhost:5001/api/projects/p1/partidas";
const params = { params: Promise.resolve({ id: "p1" }) };
const PROYECTO = { id: "p1", codigo: "PRY-001" };

beforeEach(async () => {
  await conSesion();
  vi.mocked(prisma.proyecto.findUnique).mockReset();
  vi.mocked(prisma.partidaProyecto.findMany).mockReset();
  vi.mocked(prisma.partidaProyecto.create).mockReset();
});

describe("GET /api/projects/[id]/partidas — control de gasto (spec 008, SC-007)", () => {
  it("rechaza con 401 sin sesión", async () => {
    await sinSesion();

    const res = await GET(new NextRequest(url), params);

    expect(res.status).toBe(401);
    expect(prisma.partidaProyecto.findMany).not.toHaveBeenCalled();
  });

  it("devuelve total planeado, total ejecutado y desviación, calculados al leer", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.partidaProyecto.findMany).mockResolvedValue([
      { id: "pa1", concepto: "Personal", montoPlaneado: 1000, montoEjecutado: 800 },
      { id: "pa2", concepto: "Viáticos", montoPlaneado: 500, montoEjecutado: 300 },
    ] as never);

    const res = await GET(new NextRequest(url), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.partidas).toHaveLength(2);
    expect(body.resumen).toEqual({
      totalPlaneado: 1500,
      totalEjecutado: 1100,
      desviacion: -400,
    });
  });

  it("el sobrecoste se MUESTRA como desviación positiva; el control informa, no impide", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.partidaProyecto.findMany).mockResolvedValue([
      { id: "pa1", concepto: "Personal", montoPlaneado: 1000, montoEjecutado: 1250.5 },
    ] as never);

    const body = await (await GET(new NextRequest(url), params)).json();

    expect(body.resumen.desviacion).toBe(250.5);
  });

  it("un proyecto sin partidas da ceros, no NaN", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.partidaProyecto.findMany).mockResolvedValue([] as never);

    const body = await (await GET(new NextRequest(url), params)).json();

    expect(body.resumen).toEqual({ totalPlaneado: 0, totalEjecutado: 0, desviacion: 0 });
  });

  it("responde 404 si el proyecto no existe", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(null);

    expect((await GET(new NextRequest(url), params)).status).toBe(404);
  });
});

describe("POST /api/projects/[id]/partidas (spec 008, FR-012)", () => {
  it("crea la partida con planeado y ejecutado", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);
    vi.mocked(prisma.partidaProyecto.create).mockResolvedValue({
      id: "pa1",
      concepto: "Personal",
    } as never);

    const res = await POST(
      peticionJson(url, { concepto: "Personal", montoPlaneado: 1000, montoEjecutado: 250 }),
      params,
    );

    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.partidaProyecto.create).mock.calls[0][0].data).toMatchObject({
      proyectoId: "p1",
      concepto: "Personal",
      montoPlaneado: 1000,
      montoEjecutado: 250,
      moneda: "COP",
    });
  });

  it("rechaza con 400 un monto negativo (US5-2)", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);

    const res = await POST(peticionJson(url, { concepto: "X", montoPlaneado: -1 }), params);

    expect(res.status).toBe(400);
    expect(prisma.partidaProyecto.create).not.toHaveBeenCalled();
  });

  it("rechaza con 400 una partida sin concepto", async () => {
    vi.mocked(prisma.proyecto.findUnique).mockResolvedValue(PROYECTO as never);

    const res = await POST(peticionJson(url, { montoPlaneado: 10 }), params);

    expect(res.status).toBe(400);
    expect(prisma.partidaProyecto.create).not.toHaveBeenCalled();
  });
});
