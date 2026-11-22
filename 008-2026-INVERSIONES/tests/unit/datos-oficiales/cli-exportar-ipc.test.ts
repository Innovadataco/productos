// scripts/exportar-ipc.ts como proceso, sin red ni base: el CSV canónico va SOLO a stdout y todo lo demás a stderr; los
// errores de uso, de terminal y de archivo salen con 2 y los del anexo con 1, sin nada en stdout. Nada imprime rutas ni
// valores. El entorno del hijo es mínimo. El proceso mide el periodo contra el hoy real: el anexo ficticio es de
// 1997–1999 (cerrado) y el mes abierto se prueba con 2099. Valores inventados (anexo-ipc.ficticio.ts).
import { spawnSync } from "node:child_process";
import { closeSync, fchmodSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { POR_CLI_MS, RAIZ, entornoMinimo } from "../../ayudas/cli";
import { anexoIpc, csvEsperado, valorCanonico } from "./anexo-ipc.ficticio";
import { MAX_BYTES_ANEXO_IPC } from "@/datos-oficiales/fuentes/dane-ipc";

const TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const SCRIPT = join("scripts", "exportar-ipc.ts");
const USO = "Uso: npx tsx scripts/exportar-ipc.ts --archivo <anex-IPC-Indices.xlsx>";
const carpeta = mkdtempSync(join(tmpdir(), "inv008-carpeta-ficticia-"));
afterAll(() => rmSync(carpeta, { recursive: true, force: true }));
const NUNCA = ["carpeta-ficticia", ...[0, 4, 30].map(valorCanonico)];

interface Salida { readonly codigo: number | null; readonly stdout: string; readonly stderr: string }
function correr(args: readonly string[], extra: Record<string, string> = {}): Salida {
  const r = spawnSync(TSX, [SCRIPT, ...args], { cwd: RAIZ, env: entornoMinimo(extra), encoding: "utf8", timeout: POR_CLI_MS });
  return { codigo: r.status, stdout: r.stdout, stderr: r.stderr };
}
/** Falla con `codigo`, dice `esperado` por stderr, no escribe nada en stdout y no repite rutas ni valores. */
function rechaza(s: Salida, codigo: number, esperado: string): void {
  expect(s.codigo, s.stderr).toBe(codigo);
  expect(s.stderr).toContain(esperado);
  expect(s.stdout).toBe("");
  for (const dato of NUNCA) expect(s.stderr, dato).not.toContain(dato);
}
const archivo = (nombre: string, contenido: string | Uint8Array): string => {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
};

describe("exportar-ipc · como proceso, sin red ni base", { timeout: 12 * POR_CLI_MS }, () => {
  it("argumentos inválidos (ninguno, --ayuda, posicional, --archivo sin ruta): 2 con su uso y nada en stdout", () => {
    for (const args of [[], ["--ayuda"], [join(carpeta, "x.xlsx")], ["--archivo"]]) rechaza(correr(args), 2, USO);
  });

  it("npm se quedó con --archivo: 2", () => {
    rechaza(correr([], { npm_config_archivo: join(carpeta, "x.xlsx") }), 2, "npm se quedó con --archivo");
  });

  // Una terminal de verdad con script(1): BSD en macOS, util-linux en Linux (CI). Su entrada es /dev/null.
  it("con stdout en una terminal se niega con SALIDA_TERMINAL y 2, sin leer el anexo", () => {
    const comando = [TSX, SCRIPT, "--archivo", join(carpeta, "no-existe.xlsx")];
    const args = process.platform === "darwin" ? ["-q", "/dev/null", ...comando] : ["-qec", comando.map((a) => `'${a}'`).join(" "), "/dev/null"];
    const r = spawnSync("script", args, { cwd: RAIZ, env: entornoMinimo({}), encoding: "utf8", timeout: POR_CLI_MS, stdio: ["ignore", "pipe", "pipe"] });
    const texto = `${r.stdout}${r.stderr}`;
    expect(r.status, texto).toBe(2);
    expect(texto).toContain("SALIDA_TERMINAL");
    expect(texto).not.toContain("ANEXO_ILEGIBLE");
  });

  it("anexo inexistente o que no es regular: 2 con su código, sin la ruta", () => {
    rechaza(correr(["--archivo", join(carpeta, "no-existe.xlsx")]), 2, "ANEXO_ILEGIBLE");
    rechaza(correr(["--archivo", carpeta]), 2, "ANEXO_NO_REGULAR");
  });

  it(`más de ${MAX_BYTES_ANEXO_IPC} bytes: 1 ANEXO_DEMASIADO_GRANDE`, () => {
    rechaza(correr(["--archivo", archivo("grande.ficticio.xlsx", new Uint8Array(MAX_BYTES_ANEXO_IPC + 1).fill(0x50))]), 1, "ANEXO_DEMASIADO_GRANDE");
  });

  it("lo que no es un xlsx: 1 ANEXO_ZIP; un anexo con un hueco: 1 DANE_HUECO con la celda", () => {
    rechaza(correr(["--archivo", archivo("no-zip.ficticio.xlsx", "FICT no es un xlsx\n")]), 1, "ANEXO_ZIP");
    const hueco = archivo("hueco.ficticio.xlsx", anexoIpc({ valor: (k) => (k === 5 ? "" : undefined) }));
    rechaza(correr(["--archivo", hueco]), 1, "DANE_HUECO · celda B15");
  });

  it("un mes que no ha terminado (2099): 1 MES_ABIERTO, nada en stdout", () => {
    rechaza(correr(["--archivo", archivo("abierto.ficticio.xlsx", anexoIpc({ primerAnio: 2099, anios: 1, publicados: 1 }))]), 1, "MES_ABIERTO · celda B10");
  });

  it("anexo válido: 0, stdout es exactamente el CSV canónico y stderr solo el resumen", () => {
    const s = correr(["--archivo", archivo("anexo.ficticio.xlsx", anexoIpc())]);
    expect(s.codigo, s.stderr).toBe(0);
    expect(s.stdout).toBe(csvEsperado());
    expect(s.stderr).toContain("IPC_INDICE · 31 meses · del 1997-01 al 1999-07");
    for (const dato of NUNCA) expect(s.stderr, dato).not.toContain(dato);
  });

  // El dato es público (no dice nada del dueño): a diferencia de fondo:exportar, un archivo 644 sirve (sin SALIDA_NO_PRIVADA).
  it("con stdout en un archivo 644: 0 y el archivo trae el CSV", () => {
    const ruta = join(carpeta, "ipc.ficticio.csv");
    const fd = openSync(ruta, "w");
    fchmodSync(fd, 0o644);
    try {
      const r = spawnSync(TSX, [SCRIPT, "--archivo", archivo("anexo-644.ficticio.xlsx", anexoIpc())], {
        cwd: RAIZ, env: entornoMinimo({}), encoding: "utf8", timeout: POR_CLI_MS, stdio: ["ignore", fd, "pipe"],
      });
      expect(r.status, r.stderr).toBe(0);
    } finally {
      closeSync(fd);
    }
    expect(readFileSync(ruta, "utf8")).toBe(csvEsperado());
  });
});
