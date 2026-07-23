import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import { peticionJson } from "@/test/authMock";
import { GET, POST } from "./route";

describe("GET /api/licitaciones/estados", () => {
  beforeEach(() => {
    vi.mocked(prisma.licitacionStatus.findMany).mockReset();
  });

  it("devuelve la lista de estados", async () => {
    const fixture = [{ id: 1, key: "abierta", nombreOficial: "Abierta" }];
    vi.mocked(prisma.licitacionStatus.findMany).mockResolvedValue(fixture as never);

    const res = await GET(new NextRequest("http://localhost:5001/api/licitaciones/estados"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.licitacionStatus.findMany).mockRejectedValue(new Error("fallo interno en 10.0.0.7"));

    const res = await GET(new NextRequest("http://localhost:5001/api/licitaciones/estados"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error al obtener estados" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.7");
  });
});

describe("POST /api/licitaciones/estados", () => {
  beforeEach(() => {
    vi.mocked(prisma.licitacionStatus.create).mockReset();
  });

  it("rechaza con 400 si faltan key o nombreOficial", async () => {
    const res = await POST(
      peticionJson("http://localhost:5001/api/licitaciones/estados", { key: "abierta" }),
    );

    expect(res.status).toBe(400);
    expect(prisma.licitacionStatus.create).not.toHaveBeenCalled();
  });

  it("crea un estado y responde 201", async () => {
    const creado = { id: 1, key: "abierta", nombreOficial: "Abierta" };
    vi.mocked(prisma.licitacionStatus.create).mockResolvedValue(creado as never);

    const res = await POST(
      peticionJson("http://localhost:5001/api/licitaciones/estados", {
        key: "abierta",
        nombreOficial: "Abierta",
      }),
    );

    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.licitacionStatus.create).mock.calls[0][0].data).toEqual({
      key: "abierta",
      nombreOficial: "Abierta",
    });
  });
});
