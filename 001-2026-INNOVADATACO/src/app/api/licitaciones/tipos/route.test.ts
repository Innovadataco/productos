import { describe, it, expect, beforeEach, vi } from "vitest";

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

const url = "http://localhost:5001/api/licitaciones/tipos";

beforeEach(async () => {
  await conSesion();
});

describe("GET /api/licitaciones/tipos (spec 006, FR-002)", () => {
  beforeEach(() => {
    vi.mocked(prisma.tipoOportunidad.findMany).mockReset();
  });

  it("rechaza con 401 sin sesión y no consulta la base", async () => {
    await sinSesion();
    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    expect(prisma.tipoOportunidad.findMany).not.toHaveBeenCalled();
  });

  it("devuelve el catálogo de tipos", async () => {
    const fixture = [{ id: 1, key: "licitacion-publica", nombreOficial: "Licitación pública", exigeNumero: true, exigeFechaApertura: true }];
    vi.mocked(prisma.tipoOportunidad.findMany).mockResolvedValue(fixture as never);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
  });

  it("no filtra el mensaje de excepción al cliente (FR-020)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.tipoOportunidad.findMany).mockRejectedValue(new Error("fallo en 10.0.0.9"));
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error al obtener tipos" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.9");
  });
});

describe("POST /api/licitaciones/tipos (spec 006, FR-002)", () => {
  beforeEach(() => {
    vi.mocked(prisma.tipoOportunidad.create).mockReset();
  });

  it("rechaza con 401 sin sesión, sin crear nada", async () => {
    await sinSesion();
    const res = await POST(peticionJson(url, { key: "x", nombreOficial: "X" }));
    expect(res.status).toBe(401);
    expect(prisma.tipoOportunidad.create).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si faltan key o nombreOficial", async () => {
    const res = await POST(peticionJson(url, { key: "solo-key" }));
    expect(res.status).toBe(400);
    expect(prisma.tipoOportunidad.create).not.toHaveBeenCalled();
  });

  it("crea un tipo con sus banderas de obligatoriedad", async () => {
    vi.mocked(prisma.tipoOportunidad.create).mockResolvedValue({ id: 4, key: "invitacion", nombreOficial: "Invitación" } as never);
    const res = await POST(
      peticionJson(url, { key: "invitacion", nombreOficial: "Invitación", exigeNumero: false, exigeFechaApertura: true }),
    );
    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.tipoOportunidad.create).mock.calls[0][0].data).toEqual({
      key: "invitacion",
      nombreOficial: "Invitación",
      exigeNumero: false,
      exigeFechaApertura: true,
    });
  });

  it("responde 409 ante clave duplicada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.tipoOportunidad.create).mockRejectedValue({ code: "P2002" });
    const res = await POST(peticionJson(url, { key: "licitacion-publica", nombreOficial: "Dup" }));
    expect(res.status).toBe(409);
  });
});
