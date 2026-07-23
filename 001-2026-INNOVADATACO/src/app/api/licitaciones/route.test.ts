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

const LICITACION_VALIDA = {
  numero: "LIC-2026-001",
  titulo: "Adquisición de equipos",
  estadoId: "1",
  fechaApertura: "2026-08-01",
};

describe("GET /api/licitaciones", () => {
  beforeEach(() => {
    vi.mocked(prisma.licitacion.findMany).mockReset();
  });

  it("devuelve la lista de licitaciones", async () => {
    const fixture = [{ id: "lic1", numero: "LIC-2026-001", titulo: "Adquisición" }];
    vi.mocked(prisma.licitacion.findMany).mockResolvedValue(fixture as never);

    const res = await GET(new NextRequest("http://localhost:5001/api/licitaciones"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
  });

  it("aplica los filtros de estado, entidad y búsqueda", async () => {
    vi.mocked(prisma.licitacion.findMany).mockResolvedValue([] as never);

    await GET(
      new NextRequest("http://localhost:5001/api/licitaciones?estado=abierta&entidad=3&q=equipos"),
    );

    const { where } = primerArgumento(vi.mocked(prisma.licitacion.findMany));
    expect(where).toMatchObject({
      estado: { key: "abierta" },
      entidadId: 3,
    });
    expect(where?.OR).toHaveLength(3);
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.licitacion.findMany).mockRejectedValue(
      new Error("relation \"Licitacion\" does not exist en 10.0.0.5"),
    );

    const res = await GET(new NextRequest("http://localhost:5001/api/licitaciones"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error al obtener licitaciones" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});

describe("POST /api/licitaciones", () => {
  beforeEach(() => {
    vi.mocked(prisma.licitacion.create).mockReset();
  });

  it("rechaza con 401 si no hay sesión", async () => {
    await sinSesion();

    const res = await POST(peticionJson("http://localhost:5001/api/licitaciones", LICITACION_VALIDA));

    expect(res.status).toBe(401);
    expect(prisma.licitacion.create).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si faltan campos requeridos", async () => {
    await conSesion();

    const res = await POST(
      peticionJson("http://localhost:5001/api/licitaciones", { titulo: "Sin número ni estado" }),
    );

    expect(res.status).toBe(400);
    expect(prisma.licitacion.create).not.toHaveBeenCalled();
  });

  it("crea la licitación y responde 201", async () => {
    await conSesion();
    const creada = { id: "lic1", ...LICITACION_VALIDA };
    vi.mocked(prisma.licitacion.create).mockResolvedValue(creada as never);

    const res = await POST(peticionJson("http://localhost:5001/api/licitaciones", LICITACION_VALIDA));

    expect(res.status).toBe(201);
    const data = primerArgumento(vi.mocked(prisma.licitacion.create)).data;
    expect(data.numero).toBe("LIC-2026-001");
    expect(data.estadoId).toBe(1); // parseInt aplicado
  });
});
