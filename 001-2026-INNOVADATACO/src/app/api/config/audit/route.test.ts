import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

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

    expect(vi.mocked(prisma.auditLog.findMany).mock.calls[0][0].take).toBe(50);
  });

  it("topa el límite en 200 aunque se pida más", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);

    await GET(new NextRequest(`${url}?limit=5000`));

    expect(vi.mocked(prisma.auditLog.findMany).mock.calls[0][0].take).toBe(200);
  });

  it("filtra por acción y estado, y pagina con offset", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([] as never);

    await GET(new NextRequest(`${url}?action=upload_pdf&status=error&offset=10`));

    const args = vi.mocked(prisma.auditLog.findMany).mock.calls[0][0];
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
