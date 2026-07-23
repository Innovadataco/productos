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

const url = "http://localhost:5001/api/projects";
const PROYECTO_VALIDO = { nombre: "Proyecto piloto", codigo: "PRY-001" };

describe("GET /api/projects", () => {
  beforeEach(() => {
    vi.mocked(prisma.proyecto.findMany).mockReset();
  });

  it("rechaza con 401 si no hay sesión y no devuelve datos (FR-012)", async () => {
    await sinSesion();

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "No autenticado" });
    expect(prisma.proyecto.findMany).not.toHaveBeenCalled();
  });

  it("devuelve el listado con sesión válida, sin regresión (FR-013)", async () => {
    await conSesion();
    const fixture = [
      { id: "p1", nombre: "Proyecto piloto", codigo: "PRY-001" },
      { id: "p2", nombre: "Segundo", codigo: "PRY-002" },
    ];
    vi.mocked(prisma.proyecto.findMany).mockResolvedValue(fixture as never);

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
    expect(vi.mocked(prisma.proyecto.findMany).mock.calls[0][0]).toEqual({
      orderBy: { createdAt: "desc" },
    });
  });

  it("no filtra el mensaje de excepción al cliente (FR-015)", async () => {
    await conSesion();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.proyecto.findMany).mockRejectedValue(
      new Error('relation "Proyecto" does not exist en 10.0.0.5'),
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error listando proyectos" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
    expect(JSON.stringify(body)).not.toContain("does not exist");
  });
});

describe("POST /api/projects", () => {
  beforeEach(() => {
    vi.mocked(prisma.proyecto.create).mockReset();
  });

  it("rechaza con 401 si no hay sesión", async () => {
    await sinSesion();

    const res = await POST(peticionJson(url, PROYECTO_VALIDO));

    expect(res.status).toBe(401);
    expect(prisma.proyecto.create).not.toHaveBeenCalled();
  });

  it("crea el proyecto y responde 201", async () => {
    await conSesion();
    vi.mocked(prisma.proyecto.create).mockResolvedValue({ id: "p1", ...PROYECTO_VALIDO } as never);

    const res = await POST(peticionJson(url, PROYECTO_VALIDO));

    expect(res.status).toBe(201);
  });

  it("responde 409 cuando el código ya existe (P2002)", async () => {
    await conSesion();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.proyecto.create).mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const res = await POST(peticionJson(url, PROYECTO_VALIDO));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({ error: "Ya existe un proyecto con ese código" });
  });
});
