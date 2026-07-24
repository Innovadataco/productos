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
import { conSesion, sinSesion } from "@/test/authMock";
import { GET } from "./route";

beforeEach(async () => {
  await conSesion();
  vi.mocked(prisma.proyecto.findMany).mockReset();
});

describe("GET /api/projects/cartera (spec 014, FR-002)", () => {
  it("rechaza con 401 sin sesión, sin tocar la base", async () => {
    await sinSesion();

    const res = await GET();

    expect(res.status).toBe(401);
    expect(prisma.proyecto.findMany).not.toHaveBeenCalled();
  });

  it("devuelve cada proyecto con sus agregados calculados al leer (SC-002)", async () => {
    vi.mocked(prisma.proyecto.findMany).mockResolvedValue([
      {
        id: "p1",
        codigo: "PRY-001",
        nombre: "Piloto",
        cliente: "IDC",
        currentPhase: "execution",
        entregables: [{ avance: 80 }, { avance: 20 }],
        partidas: [{ montoPlaneado: 5000 }, { montoPlaneado: 2500 }],
        riesgos: [{ estado: "abierto" }, { estado: "mitigado" }, { estado: "cerrado" }],
      },
    ] as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body[0]).toMatchObject({
      codigo: "PRY-001",
      faseNombre: "Ejecución",
      presupuestoTotal: 7500,
      avancePromedio: 50,
      riesgosAbiertos: 2, // abierto + mitigado; cerrado no
    });
  });

  it("pide entregables, partidas y riesgos para poder agregarlos", async () => {
    vi.mocked(prisma.proyecto.findMany).mockResolvedValue([] as never);

    await GET();

    const include = vi.mocked(prisma.proyecto.findMany).mock.calls[0][0]?.include;
    expect(include).toMatchObject({ entregables: expect.anything(), partidas: expect.anything(), riesgos: expect.anything() });
  });

  it("con 0 proyectos devuelve lista vacía, no rompe (SC-002)", async () => {
    vi.mocked(prisma.proyecto.findMany).mockResolvedValue([] as never);

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });

  it("no filtra el mensaje de excepción al cliente (§0.3)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.proyecto.findMany).mockRejectedValue(new Error("db en 10.0.0.5:5435"));

    const res = await GET();

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("10.0.0.5");
  });
});
