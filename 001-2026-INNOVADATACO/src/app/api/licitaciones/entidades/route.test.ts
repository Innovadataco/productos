import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import { peticionJson } from "@/test/authMock";
import { GET, POST } from "./route";

describe("GET /api/licitaciones/entidades", () => {
  beforeEach(() => {
    vi.mocked(prisma.entidadLicitacion.findMany).mockReset();
  });

  it("devuelve la lista de entidades", async () => {
    const fixture = [{ id: 1, key: "minhacienda", nombreOficial: "Ministerio de Hacienda" }];
    vi.mocked(prisma.entidadLicitacion.findMany).mockResolvedValue(fixture as never);

    const res = await GET(new NextRequest("http://localhost:5001/api/licitaciones/entidades"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.entidadLicitacion.findMany).mockRejectedValue(new Error("fallo interno en 10.0.0.7"));

    const res = await GET(new NextRequest("http://localhost:5001/api/licitaciones/entidades"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error al obtener entidades" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.7");
  });
});

describe("POST /api/licitaciones/entidades", () => {
  beforeEach(() => {
    vi.mocked(prisma.entidadLicitacion.create).mockReset();
  });

  it("rechaza con 400 si faltan key o nombreOficial", async () => {
    const res = await POST(
      peticionJson("http://localhost:5001/api/licitaciones/entidades", { key: "minhacienda" }),
    );

    expect(res.status).toBe(400);
    expect(prisma.entidadLicitacion.create).not.toHaveBeenCalled();
  });

  it("crea una entidad y responde 201", async () => {
    const creado = { id: 1, key: "minhacienda", nombreOficial: "Ministerio de Hacienda" };
    vi.mocked(prisma.entidadLicitacion.create).mockResolvedValue(creado as never);

    const res = await POST(
      peticionJson("http://localhost:5001/api/licitaciones/entidades", {
        key: "minhacienda",
        nombreOficial: "Ministerio de Hacienda",
      }),
    );

    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.entidadLicitacion.create).mock.calls[0][0].data).toEqual({
      key: "minhacienda",
      nombreOficial: "Ministerio de Hacienda",
    });
  });
});
