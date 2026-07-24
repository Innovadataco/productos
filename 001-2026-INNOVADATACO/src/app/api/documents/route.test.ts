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
vi.mock("@/lib/audit", () => ({ auditLog: vi.fn() }));
// La extracción real de PDF y la cola quedan fuera del test unitario.
vi.mock("@/lib/documentProcessor", () => ({ extractPdfText: vi.fn() }));
// El disco también: sin esto, el caso de travesía de directorios escribía un
// fichero DE VERDAD en uploads/ en cada `npm test`. La aserción no pierde nada
// —comprueba el `archivoUrl` que recibe Prisma, no el inodo—, y el árbol del
// CEO deja de llenarse de basura de la suite.
vi.mock("fs/promises", () => ({ writeFile: vi.fn(), mkdir: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { extractPdfText } from "@/lib/documentProcessor";
import { conSesion, sinSesion, peticionJson } from "@/test/authMock";
import { GET, POST, PATCH } from "./route";

// Todos los casos corren con sesión válida salvo los de 401 (spec 005, US-3).
beforeEach(async () => {
  await conSesion();
});

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

  // Validación de subida (§2.6/§5.3). Hasta la spec 009 esta ruta —la puerta de
  // Base Oficial— no validaba nada: ni tipo, ni tamaño, ni saneaba el nombre.
  function peticionConArchivo(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("titulo", "Documento de prueba");
    form.append("tipo", "resolucion");
    return new Request(url, { method: "POST", body: form }) as never;
  }

  it("rechaza con 400 lo que no es PDF (§2.6)", async () => {
    const res = await POST(
      peticionConArchivo(new File(["MZ"], "malicioso.exe", { type: "application/octet-stream" })),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Solo se admiten archivos PDF" });
    expect(prisma.documentoOficial.create).not.toHaveBeenCalled();
  });

  it("rechaza con 413 un PDF que excede los 10 MB (§2.6)", async () => {
    // Archivo real: al viajar por el cuerpo de la petición, el File se
    // reconstruye y un `size` falseado con defineProperty no sobrevive.
    const enorme = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "enorme.pdf", {
      type: "application/pdf",
    });

    const res = await POST(peticionConArchivo(enorme));

    expect(res.status).toBe(413);
    expect(prisma.documentoOficial.create).not.toHaveBeenCalled();
  });

  it("sanea el nombre del archivo: un '../' no puede escribir fuera de uploads/ (§5.3)", async () => {
    vi.mocked(extractPdfText).mockResolvedValue("texto");
    vi.mocked(prisma.documentoOficial.create).mockResolvedValue({ id: "doc1" } as never);

    await POST(peticionConArchivo(new File(["%PDF-1.4"], "../../etc/passwd.pdf", { type: "application/pdf" })));

    const { archivoUrl } = vi.mocked(prisma.documentoOficial.create).mock.calls[0][0].data;
    // Lo que corta la travesía no es que desaparezcan los puntos, es que
    // desaparecen las barras: el nombre ya no puede salir de uploads/.
    expect(String(archivoUrl).split("/")).toHaveLength(3);
    expect(archivoUrl).toMatch(/^\/uploads\/\d+_\.\._\.\._etc_passwd\.pdf$/);
  });
});

describe("GET /api/documents", () => {
  beforeEach(() => {
    vi.mocked(prisma.documentoOficial.findMany).mockReset();
  });

  it("devuelve solo los documentos activos por defecto", async () => {
    const fixture = [{ id: "doc1", titulo: "Resolución 1234" }];
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue(fixture as never);

    vi.mocked(prisma.documentoOficial.count).mockResolvedValue(1 as never);

    const res = await GET(new NextRequest(url));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toEqual(fixture);
    expect(primerArgumento(vi.mocked(prisma.documentoOficial.findMany)).where).toEqual({
      activo: true,
    });
  });

  it("pagina según §3.3: primera página por defecto y metadatos (spec 009, FR-004)", async () => {
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.documentoOficial.count).mockResolvedValue(30 as never);

    const res = await GET(new NextRequest(url));
    const body = await res.json();

    expect(body.pagination).toEqual({ page: 1, pageSize: 25, total: 30, totalPages: 2 });
    expect(primerArgumento(vi.mocked(prisma.documentoOficial.findMany))).toMatchObject({
      skip: 0,
      take: 25,
    });
  });

  it("respeta page/pageSize y acota el tamaño máximo (spec 009, FR-004)", async () => {
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.documentoOficial.count).mockResolvedValue(0 as never);

    await GET(new NextRequest(`${url}?page=2&pageSize=5`));
    expect(primerArgumento(vi.mocked(prisma.documentoOficial.findMany))).toMatchObject({
      skip: 5,
      take: 5,
    });

    await GET(new NextRequest(`${url}?pageSize=99999`));
    // Última llamada: `primerArgumento` mira la primera y aquí van dos.
    const ultima = vi.mocked(prisma.documentoOficial.findMany).mock.calls.at(-1)?.[0];
    expect(ultima?.take).toBe(100);
  });

  it("incluye inactivos y filtra por status cuando se pide", async () => {
    vi.mocked(prisma.documentoOficial.findMany).mockResolvedValue([] as never);

    await GET(new NextRequest(`${url}?includeInactive=true&status=queued`));

    expect(primerArgumento(vi.mocked(prisma.documentoOficial.findMany)).where).toEqual({
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
    const data = primerArgumento(vi.mocked(prisma.documentoOficial.update)).data;
    expect(data).toEqual({ titulo: "Nuevo" });
    expect(data).not.toHaveProperty("activo");
    expect(data).not.toHaveProperty("archivoUrl");
  });
});

describe("GET /api/documents — sesión obligatoria (spec 005, FR-008)", () => {
  it("responde 401 sin sesión y no consulta la base", async () => {
    await sinSesion();
    vi.mocked(prisma.documentoOficial.findMany).mockReset();

    const res = await GET(new NextRequest("http://localhost:5001/api/documents"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "No autenticado" });
    expect(prisma.documentoOficial.findMany).not.toHaveBeenCalled();
  });
});
