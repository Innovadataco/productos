import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test/prismaMock");
  return { prisma: createPrismaMock() };
});
vi.mock("@/lib/auth", async () => {
  const { createAuthMock } = await import("@/test/authMock");
  return createAuthMock();
});
// No se escribe a disco en las pruebas.
vi.mock("fs/promises", () => ({ writeFile: vi.fn(), mkdir: vi.fn() }));

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { conSesion, sinSesion } from "@/test/authMock";
import { GET, POST } from "./route";

const url = "http://localhost:5001/api/licitaciones/op1/documentos";
const params = { params: Promise.resolve({ id: "op1" }) };

function subida(nombreArchivo: string, size = 1000): NextRequest {
  const contenido = new Uint8Array(size);
  const file = new File([contenido], nombreArchivo);
  const form = new FormData();
  form.set("file", file);
  return new NextRequest(url, { method: "POST", body: form });
}

beforeEach(async () => {
  await conSesion();
  vi.mocked(prisma.licitacion.findUnique).mockReset().mockResolvedValue({ id: "op1" } as never);
  vi.mocked(prisma.licitacionDocumento.create).mockReset().mockResolvedValue({ id: "doc1" } as never);
  // $executeRaw es la vía por la que la ingesta RAG inserta chunks; aquí nunca se toca.
  vi.mocked(prisma.$executeRaw).mockReset();
});

describe("POST expediente (spec 006, US4) — SIN RAG", () => {
  it("rechaza con 401 sin sesión, sin crear nada", async () => {
    await sinSesion();
    const res = await POST(subida("pliegos.pdf"), params);
    expect(res.status).toBe(401);
    expect(prisma.licitacionDocumento.create).not.toHaveBeenCalled();
  });

  it("404 si la oportunidad no existe", async () => {
    vi.mocked(prisma.licitacion.findUnique).mockResolvedValue(null);
    const res = await POST(subida("pliegos.pdf"), params);
    expect(res.status).toBe(404);
  });

  it("acepta un PDF y lo asocia a la oportunidad", async () => {
    const res = await POST(subida("pliegos.pdf"), params);
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.licitacionDocumento.create).mock.calls[0][0].data;
    expect(data.licitacionId).toBe("op1");
    expect(data.tipo).toBe("pdf");
  });

  it("acepta un Excel (.xlsx y .xls)", async () => {
    expect((await POST(subida("presupuesto.xlsx"), params)).status).toBe(201);
    expect((await POST(subida("anexo.xls"), params)).status).toBe(201);
  });

  it("rechaza un tipo no permitido con 400", async () => {
    const res = await POST(subida("malicioso.exe"), params);
    expect(res.status).toBe(400);
    expect(prisma.licitacionDocumento.create).not.toHaveBeenCalled();
  });

  it("rechaza con 413 un archivo que excede el tamaño", async () => {
    const res = await POST(subida("enorme.pdf", 11 * 1024 * 1024), params);
    expect(res.status).toBe(413);
    expect(prisma.licitacionDocumento.create).not.toHaveBeenCalled();
  });

  it("SC-008: el expediente NO genera chunks ni pasa por el RAG", async () => {
    await POST(subida("pliegos.pdf"), params);
    // La ingesta RAG inserta chunks vía $executeRaw; el expediente no lo llama.
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("no filtra err.message al cliente ante un fallo interno (FR-020)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.licitacionDocumento.create).mockRejectedValue(new Error("disco lleno en 10.0.0.4"));
    const res = await POST(subida("pliegos.pdf"), params);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error al subir el documento" });
    expect(JSON.stringify(body)).not.toContain("10.0.0.4");
  });
});

describe("GET expediente (spec 006, FR-015)", () => {
  it("rechaza con 401 sin sesión", async () => {
    await sinSesion();
    const res = await GET(new NextRequest(url), params);
    expect(res.status).toBe(401);
  });

  it("lista los documentos de la oportunidad", async () => {
    vi.mocked(prisma.licitacionDocumento.findMany).mockResolvedValue([
      { id: "doc1", nombre: "Pliegos", tipo: "pdf", contenido: "/uploads/expedientes/x.pdf", createdAt: new Date() },
    ] as never);
    const res = await GET(new NextRequest(url), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].tipo).toBe("pdf");
  });
});
