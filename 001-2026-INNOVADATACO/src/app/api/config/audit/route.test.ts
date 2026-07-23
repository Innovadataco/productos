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
import { conSesion, sinSesion } from "@/test/authMock";
import { GET } from "./route";

// Todos los casos corren con sesión válida salvo los de 401 (spec 005, US-3).
beforeEach(async () => {
  await conSesion();
});

const url = "http://localhost:5001/api/config/audit";

describe("GET /api/config/audit", () => {
  beforeEach(() => {
    vi.mocked(prisma.auditLog.findMany).mockReset();
  });

  it("devuelve los registros de auditoría", async () => {
    const fixture = [{ id: "log1", action: "upload_pdf" }];
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue(fixture as never);

    const res = await GET(new NextRequest(url));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
  });

  it("aplica el límite por defecto de 50", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);

    await GET(new NextRequest(url));

    expect(primerArgumento(vi.mocked(prisma.auditLog.findMany)).take).toBe(50);
  });

  it("topa el límite en 200 aunque se pida más", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);

    await GET(new NextRequest(`${url}?limit=5000`));

    expect(primerArgumento(vi.mocked(prisma.auditLog.findMany)).take).toBe(200);
  });

  it("filtra por acción y estado, y pagina con offset", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);

    await GET(new NextRequest(`${url}?action=upload_pdf&status=error&offset=10`));

    const args = primerArgumento(vi.mocked(prisma.auditLog.findMany));
    expect(args.where).toEqual({ action: "upload_pdf", status: "error" });
    expect(args.skip).toBe(10);
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.auditLog.findMany).mockRejectedValue(new Error("fallo en 10.0.0.8"));

    const res = await GET(new NextRequest(url));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error listando auditoría" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.8");
  });
});

describe("GET /api/config/audit — sesión obligatoria (spec 005, FR-008)", () => {
  it("responde 401 sin sesión y no consulta la base", async () => {
    await sinSesion();
    vi.mocked(prisma.auditLog.findMany).mockReset();

    const res = await GET(new NextRequest("http://localhost:5001/api/config/audit"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
