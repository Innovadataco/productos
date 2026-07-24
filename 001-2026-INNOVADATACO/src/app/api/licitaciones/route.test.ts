import { describe, it, expect, beforeEach, vi } from "vitest";
import { primerArgumento } from "@/test/mockArgs";
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
import { GET, POST } from "./route";

const url = "http://localhost:5001/api/licitaciones";

// Tipos del catálogo configurable: la licitación pública exige numero+fecha; la
// contratación directa no exige ninguno (banderas, no nombres cableados — §0.7).
const TIPO_LICITACION = { id: 1, key: "licitacion-publica", nombreOficial: "Licitación pública", exigeNumero: true, exigeFechaApertura: true };
const TIPO_DIRECTA = { id: 3, key: "contratacion-directa", nombreOficial: "Contratación directa", exigeNumero: false, exigeFechaApertura: false };

beforeEach(async () => {
  await conSesion();
});

describe("GET /api/licitaciones (oportunidades)", () => {
  beforeEach(() => {
    vi.mocked(prisma.licitacion.findMany).mockReset();
  });

  it("devuelve la lista con el total de presupuesto calculado", async () => {
    vi.mocked(prisma.licitacion.findMany).mockResolvedValue([
      { id: "op1", titulo: "Una", partidas: [{ monto: 100 }, { monto: 250 }] },
    ] as never);

    vi.mocked(prisma.licitacion.count).mockResolvedValue(1 as never);

    const res = await GET(new NextRequest(url));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items[0].totalPresupuesto).toBe(350);
  });

  it("pagina según §3.3: primera página por defecto y metadatos (spec 009, FR-004)", async () => {
    vi.mocked(prisma.licitacion.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.licitacion.count).mockResolvedValue(60 as never);

    const res = await GET(new NextRequest(url));
    const body = await res.json();

    expect(body.pagination).toEqual({ page: 1, pageSize: 25, total: 60, totalPages: 3 });
    const args = primerArgumento(vi.mocked(prisma.licitacion.findMany));
    expect(args.skip).toBe(0);
    expect(args.take).toBe(25);
  });

  it("respeta page/pageSize y acota el tamaño máximo (spec 009, FR-004)", async () => {
    vi.mocked(prisma.licitacion.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.licitacion.count).mockResolvedValue(0 as never);

    await GET(new NextRequest(`${url}?page=3&pageSize=10`));
    expect(primerArgumento(vi.mocked(prisma.licitacion.findMany))).toMatchObject({
      skip: 20,
      take: 10,
    });

    await GET(new NextRequest(`${url}?pageSize=99999`));
    // Última llamada: `primerArgumento` mira la primera y aquí van dos.
    const ultima = vi.mocked(prisma.licitacion.findMany).mock.calls.at(-1)?.[0];
    expect(ultima?.take).toBe(100);
  });

  it("aplica los filtros de estado, entidad, tipo y búsqueda", async () => {
    vi.mocked(prisma.licitacion.findMany).mockResolvedValue([] as never);

    await GET(new NextRequest(`${url}?estado=abierta&entidad=3&tipo=contratacion-directa&q=equipos`));

    const { where } = primerArgumento(vi.mocked(prisma.licitacion.findMany));
    expect(where).toMatchObject({
      estado: { key: "abierta" },
      entidadId: 3,
      tipo: { key: "contratacion-directa" },
    });
    expect(where?.OR).toHaveLength(3);
  });

  it("responde 401 sin sesión y no consulta la base", async () => {
    await sinSesion();
    vi.mocked(prisma.licitacion.findMany).mockReset();
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    expect(prisma.licitacion.findMany).not.toHaveBeenCalled();
  });

  it("no filtra el mensaje de excepción al cliente (FR-020)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.licitacion.findMany).mockRejectedValue(new Error("fallo en 10.0.0.5"));
    const res = await GET(new NextRequest(url));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error al obtener oportunidades" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});

describe("POST /api/licitaciones — validación por tipo (spec 006, FR-003)", () => {
  beforeEach(() => {
    vi.mocked(prisma.licitacion.create).mockReset();
    vi.mocked(prisma.tipoOportunidad.findUnique).mockReset();
  });

  it("rechaza con 401 sin sesión, sin crear nada", async () => {
    await sinSesion();
    const res = await POST(peticionJson(url, { titulo: "X", tipoId: "3", estadoId: "1" }));
    expect(res.status).toBe(401);
    expect(prisma.licitacion.create).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si faltan título, tipo o estado", async () => {
    const res = await POST(peticionJson(url, { titulo: "Sin tipo ni estado" }));
    expect(res.status).toBe(400);
    expect(prisma.licitacion.create).not.toHaveBeenCalled();
  });

  it("SC-001: crea una contratación directa SIN numero ni fechaApertura", async () => {
    vi.mocked(prisma.tipoOportunidad.findUnique).mockResolvedValue(TIPO_DIRECTA as never);
    vi.mocked(prisma.licitacion.create).mockResolvedValue({ id: "op1" } as never);

    const res = await POST(peticionJson(url, { titulo: "Negocio directo", tipoId: "3", estadoId: "1" }));

    expect(res.status).toBe(201);
    const data = primerArgumento(vi.mocked(prisma.licitacion.create)).data;
    expect(data.numero).toBeNull();
    expect(data.fechaApertura).toBeNull();
    expect(data.tipoId).toBe(3);
  });

  it("SC-002: rechaza una licitación pública SIN numero", async () => {
    vi.mocked(prisma.tipoOportunidad.findUnique).mockResolvedValue(TIPO_LICITACION as never);

    const res = await POST(peticionJson(url, { titulo: "Licitación", tipoId: "1", estadoId: "1", fechaApertura: "2026-08-01" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/número/i);
    expect(prisma.licitacion.create).not.toHaveBeenCalled();
  });

  it("SC-002: rechaza una licitación pública SIN fechaApertura", async () => {
    vi.mocked(prisma.tipoOportunidad.findUnique).mockResolvedValue(TIPO_LICITACION as never);

    const res = await POST(peticionJson(url, { titulo: "Licitación", tipoId: "1", estadoId: "1", numero: "LIC-1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/apertura/i);
  });

  it("crea una licitación pública completa con cronograma, ciudad y partidas", async () => {
    vi.mocked(prisma.tipoOportunidad.findUnique).mockResolvedValue(TIPO_LICITACION as never);
    vi.mocked(prisma.licitacion.create).mockResolvedValue({ id: "op1" } as never);

    const res = await POST(
      peticionJson(url, {
        titulo: "Licitación completa",
        tipoId: "1",
        estadoId: "1",
        numero: "LIC-2026-001",
        fechaApertura: "2026-08-01",
        fechaCierre: "2026-09-01",
        ciudadEjecucion: "Bogotá",
        partidas: [{ concepto: "Obra", monto: 1000, moneda: "COP" }],
      }),
    );

    expect(res.status).toBe(201);
    const data = primerArgumento(vi.mocked(prisma.licitacion.create)).data;
    expect(data.ciudadEjecucion).toBe("Bogotá");
    expect(data.fechaCierre).toBeInstanceOf(Date);
    expect(data.partidas).toEqual({ create: [{ concepto: "Obra", monto: expect.anything(), moneda: "COP" }] });
  });

  it("rechaza con 400 un tipo inexistente", async () => {
    vi.mocked(prisma.tipoOportunidad.findUnique).mockResolvedValue(null);
    const res = await POST(peticionJson(url, { titulo: "X", tipoId: "99", estadoId: "1" }));
    expect(res.status).toBe(400);
    expect(prisma.licitacion.create).not.toHaveBeenCalled();
  });

  it("rechaza con 400 una partida con monto negativo (FR-008)", async () => {
    vi.mocked(prisma.tipoOportunidad.findUnique).mockResolvedValue(TIPO_DIRECTA as never);
    const res = await POST(
      peticionJson(url, { titulo: "X", tipoId: "3", estadoId: "1", partidas: [{ concepto: "y", monto: -1 }] }),
    );
    expect(res.status).toBe(400);
    expect(prisma.licitacion.create).not.toHaveBeenCalled();
  });
});
