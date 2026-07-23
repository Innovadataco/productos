import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/auth", async () => {
  const { createAuthMock } = await import("@/test/authMock");
  return createAuthMock();
});
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
// La extracción real de PDF y la cola quedan fuera del test unitario.
vi.mock("@/lib/documentProcessor", () => ({ extractPdfText: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { extractPdfText } from "@/lib/documentProcessor";
import { conSesion, sinSesion, peticionJson } from "@/test/authMock";
import { GET, POST, PATCH } from "./route";

const url = "http://localhost:5001/api/documents";

function peticionUpload(conArchivo = true) {
  const form = new FormData();
  if (conArchivo) {
    form.append("file", new File(["%PDF-1.4 contenido"], "prueba.pdf", { type: "application/pdf" }));
    form.append("titulo", "Documento de prueba");
    form.append("tipo", "resolucion");
  }
  return new Request(url, { method: "POST", body: form }) as never;
}

describe("POST /api/documents (upload)", () => {
  beforeEach(() => {
    vi.mocked(prisma.documentoOficial.create).mockReset();
    vi.mocked(extractPdfText).mockReset();
  });

  it("rechaza con 401 si no hay sesión", async () => {
    await sinSesion();

    const res = await POST(peticionUpload());

    expect(res.status).toBe(401);
    expect(prisma.documentoOficial.create).not.toHaveBeenCalled();
  });

  it("rechaza con 400 si no se envía archivo", async () => {
    await conSesion();

    const res = await POST(peticionUpload(false));

    expect(res.status).toBe(400);
    expect(prisma.documentoOficial.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/documents", () => {
  beforeEach(() => {
    vi.mocked(prisma.documentoOficial.findMany).mockReset();
  });

  it("devuelve solo los documentos activos por defecto", async () => {
    const fixture = [{ id: "doc1", titulo: "Resolución 1234" }];
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue(fixture as never);

    const res = await GET(new NextRequest(url));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(fixture);
    expect(vi.mocked(prisma.documentoOficial.findMany).mock.calls[0][0].where).toEqual({
      activo: true,
    });
  });

  it("incluye inactivos y filtra por status cuando se pide", async () => {
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue([] as never);

    await GET(new NextRequest(`${url}?includeInactive=true&status=queued`));

    expect(vi.mocked(prisma.documentoOficial.findMany).mock.calls[0][0].where).toEqual({
      status: "queued",
    });
  });

  it("no filtra el mensaje de excepción al cliente (FR-004)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.documentoOficial.findMany).mockRejectedValue(
      new Error("no such table en 10.0.0.4"),
    );

    const res = await GET(new NextRequest(url));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error listando documentos" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.4");
  });
});

describe("PATCH /api/documents", () => {
  beforeEach(() => {
    vi.mocked(prisma.documentoOficial.update).mockReset();
  });

  it("rechaza con 401 si no hay sesión", async () => {
    await sinSesion();

    const res = await PATCH(peticionJson(url, { id: "doc1", titulo: "Nuevo" }, "PATCH"));

    expect(res.status).toBe(401);
  });

  it("rechaza con 400 si falta el id", async () => {
    await conSesion();

    const res = await PATCH(peticionJson(url, { titulo: "Nuevo" }, "PATCH"));

    expect(res.status).toBe(400);
    expect(prisma.documentoOficial.update).not.toHaveBeenCalled();
  });

  it("aplica la whitelist de campos editables e ignora el resto", async () => {
    await conSesion();
    vi.mocked(prisma.documentoOficial.update).mockResolvedValue({ id: "doc1" } as never);

    const res = await PATCH(
      peticionJson(
        url,
        { id: "doc1", titulo: "Nuevo", activo: false, archivoUrl: "/hackeado.pdf" },
        "PATCH",
      ),
    );

    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.documentoOficial.update).mock.calls[0][0].data;
    expect(data).toEqual({ titulo: "Nuevo" });
    expect(data).not.toHaveProperty("activo");
    expect(data).not.toHaveProperty("archivoUrl");
  });
});
