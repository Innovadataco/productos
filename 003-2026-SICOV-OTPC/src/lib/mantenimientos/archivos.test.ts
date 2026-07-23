import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    archivoPrograma: { updateMany: vi.fn(), create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    usuario: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/almacenamiento", () => ({
  guardarArchivo: vi.fn().mockResolvedValue({ documento: "uuid.pdf", ruta: "programas/uuid.pdf" }),
  leerArchivo: vi.fn().mockResolvedValue(Buffer.from("PDF")),
}));
vi.mock("@/lib/integracion/contexto-usuario", () => ({
  resolverContextoEfectivo: vi.fn().mockResolvedValue({ tokenAutorizado: "TOK", nitVigilado: "900853057", usuarioId: 2 }),
}));

import { prisma } from "@/lib/prisma";
import { guardarArchivo } from "@/lib/almacenamiento";
import { subirPrograma, listarProgramas, leerPrograma } from "./archivos";

const ap = prisma.archivoPrograma as unknown as Record<string, ReturnType<typeof vi.fn>>;
const CLIENTE = { id: 2, identificacion: "900853057", rolId: 2 };

beforeEach(() => {
  for (const fn of Object.values(ap)) fn.mockReset();
  ap.updateMany.mockResolvedValue({ count: 1 });
  ap.create.mockResolvedValue({ id: 9, nombreOriginal: "p.pdf", tipoId: 1, creado: new Date() });
});

describe("PDF del programa (US6 — §10.2)", () => {
  const base = { tipoId: 1, nombreOriginal: "p.pdf", contentType: "application/pdf", tamano: 1000, buffer: Buffer.from("PDF") };

  it("el último cargado queda ACTIVO y desactiva los anteriores del mismo vigilado+tipo", async () => {
    const r = await subirPrograma(base, CLIENTE);
    expect(ap.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: 2, tipoId: 1 }, data: expect.objectContaining({ estado: false }) }),
    );
    expect(ap.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: true, ruta: "programas/uuid.pdf" }) }),
    );
    expect(r.id).toBe(9);
    expect(guardarArchivo).toHaveBeenCalledWith("programas", "p.pdf", expect.any(Buffer));
  });

  it("solo PDF → 400; más de 4 MB → 413; tipo fuera de 1|2 → 400", async () => {
    await expect(subirPrograma({ ...base, nombreOriginal: "x.txt", contentType: "text/plain" }, CLIENTE)).rejects.toMatchObject({ statusCode: 400 });
    await expect(subirPrograma({ ...base, tamano: 4 * 1024 * 1024 + 1 }, CLIENTE)).rejects.toMatchObject({ statusCode: 413 });
    await expect(subirPrograma({ ...base, tipoId: 3 }, CLIENTE)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("PDF de exactamente 4 MB se acepta (borde)", async () => {
    await expect(subirPrograma({ ...base, tamano: 4 * 1024 * 1024 }, CLIENTE)).resolves.toMatchObject({ id: 9 });
  });

  it("listar: alcance D-015 (rol 2 su usuario efectivo; activo primero)", async () => {
    ap.findMany.mockResolvedValue([]);
    await listarProgramas(1, CLIENTE);
    expect(ap.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tipoId: 1, usuarioId: 2 }, orderBy: [{ estado: "desc" }, { id: "desc" }] }),
    );
  });

  it("descargar: archivo de otro vigilado → 404", async () => {
    ap.findUnique.mockResolvedValue({ id: 5, usuarioId: 99, ruta: "programas/x.pdf", nombreOriginal: "x.pdf" });
    await expect(leerPrograma(5, CLIENTE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("descargar propio → buffer + nombre original", async () => {
    ap.findUnique.mockResolvedValue({ id: 5, usuarioId: 2, ruta: "programas/x.pdf", nombreOriginal: "Mi Programa.pdf" });
    const r = await leerPrograma(5, CLIENTE);
    expect(r.nombreOriginal).toBe("Mi Programa.pdf");
    expect(r.buffer.toString()).toBe("PDF");
  });
});
