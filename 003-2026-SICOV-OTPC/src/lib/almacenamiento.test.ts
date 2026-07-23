import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { guardarArchivo, leerArchivo } from "./almacenamiento";

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "003-almacenamiento-"));
  vi.stubEnv("ALMACENAMIENTO_DIR", dir);
});

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("interfaz de almacenamiento (D-022 #2)", () => {
  it("guarda con nombre físico aleatorio conservando extensión y devuelve ruta RELATIVA", async () => {
    const r = await guardarArchivo("programas", "Programa Preventivo.pdf", Buffer.from("PDF"));
    expect(r.documento).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(r.ruta).toBe(path.join("programas", r.documento));
    expect(path.isAbsolute(r.ruta)).toBe(false);
  });

  it("lee lo guardado vía la ruta relativa", async () => {
    const r = await guardarArchivo("programas", "a.pdf", Buffer.from("contenido"));
    const leido = await leerArchivo(r.ruta);
    expect(leido.toString()).toBe("contenido");
  });

  it("rechaza path traversal fuera de la raíz (400)", async () => {
    await expect(leerArchivo("../../etc/passwd")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("archivo inexistente → 404", async () => {
    await expect(leerArchivo("programas/no-existe.pdf")).rejects.toMatchObject({ statusCode: 404 });
  });
});
