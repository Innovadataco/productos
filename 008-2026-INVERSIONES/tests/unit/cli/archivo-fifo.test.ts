// Un FIFO (o un dispositivo) en lugar del archivo no cuelga ni pasa: el CLI de la certificación de A&V sale con
// ARCHIVO_ILEGIBLE ANTES de tocar la base. Antes se colgaba en el open() de un FIFO sin escritor (el comentario
// decía «un FIFO no pasa», pero openSync bloqueaba). La base es inalcanzable a propósito; sin red. Datos inventados.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { RAIZ, entornoMinimo } from "../../ayudas/cli";

const TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const INALCANZABLE = "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test";
const carpeta = mkdtempSync(join(tmpdir(), "inv008-fifo-cli-"));
afterAll(() => rmSync(carpeta, { recursive: true, force: true }));

describe("importar-certificacion · el archivo debe ser regular", () => {
  it("con un FIFO sin escritor sale con 1 y ARCHIVO_ILEGIBLE, sin colgarse ni abrir la base", () => {
    const fifo = join(carpeta, "certificacion-ficticia.pdf");
    expect(spawnSync("mkfifo", [fifo]).status).toBe(0);
    const r = spawnSync(TSX, [join("scripts", "importar-certificacion.ts"), "--email", "dueno-fifo@ejemplo.invalid", "--fecha-corte", "2024-03-12", fifo], {
      cwd: RAIZ, env: entornoMinimo({ DATABASE_URL: INALCANZABLE }), encoding: "utf8", timeout: 20_000,
    });
    expect(r.error?.message ?? null, "se colgó abriendo el FIFO").toBeNull();
    const texto = `${r.stdout}${r.stderr}`;
    expect(r.status, texto).toBe(1);
    expect(texto).toContain("ARCHIVO_ILEGIBLE");
    expect(texto).not.toContain("PrismaClient");
    expect(texto).not.toContain("dueno-fifo");
  });

  it("con un dispositivo (/dev/zero, por un enlace .pdf) también: no lo lee hasta el tope", () => {
    const enlace = join(carpeta, "cero-ficticio.pdf");
    symlinkSync("/dev/zero", enlace);
    const r = spawnSync(TSX, [join("scripts", "importar-certificacion.ts"), "--email", "dueno-fifo@ejemplo.invalid", "--fecha-corte", "2024-03-12", enlace], {
      cwd: RAIZ, env: entornoMinimo({ DATABASE_URL: INALCANZABLE }), encoding: "utf8", timeout: 20_000,
    });
    expect(r.error?.message ?? null).toBeNull();
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain("ARCHIVO_ILEGIBLE");
  });
});
