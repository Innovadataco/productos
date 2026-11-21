// Lectura acotada de un archivo REGULAR para los CLI que reciben un archivo (importar-precios, exportar-precios
// y la certificación de A&V): un FIFO, un dispositivo o una carpeta no pasan (y un FIFO sin escritor no cuelga),
// nunca se lee más del tope + 1 y los fallos vuelven como código, nunca con la ruta. Archivos de prueba inventados.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { leerArchivoAcotado } from "@/lib/archivo-acotado";

const RAIZ = join(__dirname, "..", "..", "..");
const TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const carpeta = mkdtempSync(join(tmpdir(), "inv008-acotado-"));
afterAll(() => rmSync(carpeta, { recursive: true, force: true }));
const archivo = (nombre: string, contenido: string | Uint8Array) => {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
};

describe("leerArchivoAcotado", () => {
  it("un archivo regular dentro del tope: sus bytes tal cual", () => {
    expect(leerArchivoAcotado(archivo("bien.ficticio.txt", "hola"), 4)).toEqual({ ok: true, bytes: new Uint8Array([0x68, 0x6f, 0x6c, 0x61]) });
  });

  it("un byte sobre el tope: ARCHIVO_DEMASIADO_GRANDE", () => {
    expect(leerArchivoAcotado(archivo("grande.ficticio.txt", "holas"), 4)).toEqual({ ok: false, codigo: "ARCHIVO_DEMASIADO_GRANDE" });
  });

  it("vacío: cero bytes (lo que significan lo decide quien lo lee)", () => {
    expect(leerArchivoAcotado(archivo("vacio.ficticio.txt", ""), 4)).toEqual({ ok: true, bytes: new Uint8Array() });
  });

  it("inexistente: ARCHIVO_ILEGIBLE, sin la ruta en el resultado", () => {
    const ruta = join(carpeta, "no-existe-ficticio.txt");
    const r = leerArchivoAcotado(ruta, 4);
    expect(r).toEqual({ ok: false, codigo: "ARCHIVO_ILEGIBLE" });
    expect(JSON.stringify(r)).not.toContain("no-existe");
  });

  it("una carpeta o un dispositivo: ARCHIVO_NO_REGULAR", () => {
    const sub = join(carpeta, "sub");
    mkdirSync(sub);
    expect(leerArchivoAcotado(sub, 4)).toEqual({ ok: false, codigo: "ARCHIVO_NO_REGULAR" });
    expect(leerArchivoAcotado("/dev/null", 4)).toEqual({ ok: false, codigo: "ARCHIVO_NO_REGULAR" });
  });

  it.skipIf(process.getuid?.() === 0)("sin permiso de lectura: ARCHIVO_ILEGIBLE", () => {
    const ruta = archivo("sin-permiso.ficticio.txt", "x");
    chmodSync(ruta, 0o000);
    expect(leerArchivoAcotado(ruta, 4)).toEqual({ ok: false, codigo: "ARCHIVO_ILEGIBLE" });
  });

  it("un FIFO sin escritor: ARCHIVO_NO_REGULAR sin colgarse (en un proceso aparte, con plazo)", () => {
    const fifo = join(carpeta, "tubo-ficticio");
    expect(spawnSync("mkfifo", [fifo]).status).toBe(0);
    const prueba = archivo("fifo.ficticio.ts", `import { leerArchivoAcotado } from ${JSON.stringify(join(RAIZ, "src", "lib", "archivo-acotado.ts"))};\nprocess.stdout.write(JSON.stringify(leerArchivoAcotado(${JSON.stringify(fifo)}, 4)));\n`);
    const r = spawnSync(TSX, [prueba], { encoding: "utf8", timeout: 20_000 });
    expect(r.error?.message ?? null, "se colgó abriendo el FIFO").toBeNull();
    expect(JSON.parse(r.stdout)).toEqual({ ok: false, codigo: "ARCHIVO_NO_REGULAR" });
  });
});
