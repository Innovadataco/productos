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

const params = { params: Promise.resolve({ id: "doc1" }) };
const req = () => new NextRequest("http://localhost:5001/api/documents/doc1/logs");

describe("GET /api/documents/[id]/logs", () => {
  beforeEach(() => {
    vi.mocked(prisma.auditLog.findMany).mockReset();
  });

  it("devuelve los logs del documento", async () => {
    const fixture = [{ id: "log1", action: "upload_pdf", status: "info" }];
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue(fixture as never);

    const res = await GET(req(), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
  });

  it("filtra por el documento solicitado", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);

    await GET(req(), params);

    expect(primerArgumento(vi.mocked(prisma.auditLog.findMany)).where).toEqual({
      entityType: "DocumentoOficial",
      entityId: "doc1",
    });
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.auditLog.findMany).mockRejectedValue(new Error("fallo en 10.0.0.9"));

    const res = await GET(req(), params);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error listando logs" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.9");
  });
});

describe("GET /api/documents/[id]/logs — sesión obligatoria (spec 005, FR-008)", () => {
  it("responde 401 sin sesión y no consulta la base", async () => {
    await sinSesion();
    vi.mocked(prisma.auditLog.findMany).mockReset();

    const res = await GET(new NextRequest("http://localhost:5001/api/documents/doc1/logs"), { params: Promise.resolve({ id: "doc1" }) });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
