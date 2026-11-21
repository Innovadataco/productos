// `fondo:importar` (scripts/importar-valores-fondo.ts) y `fondo:exportar` (scripts/exportar-valores-fondo.ts) como
// proceso, sin base y sin red: los errores de uso salen con 2 y los de contenido con 1, ANTES de tocar la base (o la
// red); ninguno imprime el código del fondo, valores, fechas ni rutas. La base es inalcanzable a propósito (puerto 1
// de 127.0.0.1) y el entorno del hijo es mínimo. stdout y stderr se miran por separado (el CSV va a stdout).
// Todos los casos del exportador terminan antes de pedir a la SFC. Códigos y cifras inventados.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { POR_CLI_MS, RAIZ, entornoMinimo } from "../../ayudas/cli";
import { ENCABEZADO_CSV_FONDO, MAX_BYTES_CSV_FONDO } from "@/fondo/csv-valores";

const TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const INALCANZABLE = "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test";
const NUNCA = ["127.0.0.1", "clave-ficticia", "postgresql://", "inalcanzable_test", "9990001", "4321.5", "2024-03-11", "carpeta-ficticia"];
const carpeta = mkdtempSync(join(tmpdir(), "inv008-carpeta-ficticia-"));
afterAll(() => rmSync(carpeta, { recursive: true, force: true }));

interface Salida { readonly codigo: number | null; readonly stdout: string; readonly stderr: string }
function correr(script: string, args: readonly string[], extra: Record<string, string> = {}): Salida {
  const r = spawnSync(TSX, [join("scripts", script), ...args], { cwd: RAIZ, env: entornoMinimo({ DATABASE_URL: INALCANZABLE, ...extra }), encoding: "utf8", timeout: POR_CLI_MS });
  return { codigo: r.status, stdout: r.stdout, stderr: r.stderr };
}
function comprobar(s: Salida, codigo: number, esperado: string): void {
  const texto = `${s.stdout}${s.stderr}`;
  expect(s.codigo, texto).toBe(codigo);
  expect(texto).toContain(esperado);
  for (const dato of NUNCA) expect(texto, dato).not.toContain(dato);
  if (!esperado.includes("falló")) expect(texto, "no debía tocar la base").not.toContain("PrismaClient");
}
const archivo = (nombre: string, contenido: string | Uint8Array) => {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
};

describe("fondo:importar · como proceso, sin base", { timeout: 8 * POR_CLI_MS }, () => {
  const IMPORTAR = "importar-valores-fondo.ts";
  const USO = "Uso: npm run -s fondo:importar -- --archivo";

  it("argumentos inválidos (ninguno, --ayuda, posicional, --archivo sin ruta): 2 con su uso", () => {
    comprobar(correr(IMPORTAR, []), 2, USO);
    comprobar(correr(IMPORTAR, ["--ayuda"]), 2, USO);
    comprobar(correr(IMPORTAR, [join(carpeta, "x.csv")]), 2, USO);
    comprobar(correr(IMPORTAR, ["--archivo"]), 2, USO);
  });

  it("npm se quedó con --archivo: 2", () => {
    comprobar(correr(IMPORTAR, [], { npm_config_archivo: join(carpeta, "x.csv") }), 2, "npm se quedó con --archivo");
  });

  it("archivo inexistente o que no es regular: 2 con su código, sin la ruta", () => {
    comprobar(correr(IMPORTAR, ["--archivo", join(carpeta, "no-existe.csv")]), 2, "ARCHIVO_ILEGIBLE");
    comprobar(correr(IMPORTAR, ["--archivo", carpeta]), 2, "ARCHIVO_NO_REGULAR");
  });

  it(`más de ${MAX_BYTES_CSV_FONDO} bytes: 1 CSV_DEMASIADO_GRANDE`, () => {
    comprobar(correr(IMPORTAR, ["--archivo", archivo("grande.ficticio.csv", new Uint8Array(MAX_BYTES_CSV_FONDO + 1).fill(0x41))]), 1, "CSV_DEMASIADO_GRANDE");
  });

  it("CSV inválido: 1 con línea y código, sin abrir la base y sin repetir valores", () => {
    const ruta = archivo("malo.ficticio.csv", `${ENCABEZADO_CSV_FONDO}\n9990001,800,2024-03-11,4321.5,\n9990001,800,2024-03-11,4321.5,\n`);
    const s = correr(IMPORTAR, ["--archivo", ruta]);
    comprobar(s, 1, "CSV_INVALIDO");
    expect(s.stderr).toContain("línea 3 · FILA_REPETIDA");
  });

  it("CSV válido con la base inalcanzable: 1 con solo el nombre del error", () => {
    const ruta = archivo("bueno.ficticio.csv", `${ENCABEZADO_CSV_FONDO}\n9990001,800,2024-03-11,4321.5,\n`);
    comprobar(correr(IMPORTAR, ["--archivo", ruta]), 1, "❌ La importación de valores del fondo falló: PrismaClientInitializationError");
  });
});

describe("fondo:exportar · como proceso, sin red (todos los casos terminan antes de pedir a la SFC)", { timeout: 8 * POR_CLI_MS }, () => {
  const EXPORTAR = "exportar-valores-fondo.ts";
  const USO = "Uso: npm run -s fondo:exportar -- --fondos";

  it("argumentos inválidos (ninguno, --ayuda, sin --desde, rango al revés): 2 con su uso y nada en stdout", () => {
    for (const args of [[], ["--ayuda"], ["--fondos", join(carpeta, "l.txt")], ["--fondos", join(carpeta, "l.txt"), "--desde", "2024-03-12", "--hasta", "2024-03-11"]]) {
      const s = correr(EXPORTAR, args);
      comprobar(s, 2, USO);
      expect(s.stdout).toBe("");
    }
  });

  // Una terminal de verdad con script(1): BSD en macOS, util-linux en Linux (CI). Su entrada es /dev/null.
  it("con stdout en una terminal se niega con SALIDA_TERMINAL y 2, sin leer la lista ni pedir a la SFC", () => {
    const comando = [TSX, join("scripts", EXPORTAR), "--fondos", join(carpeta, "no-existe.txt"), "--desde", "2024-03-11"];
    const args = process.platform === "darwin" ? ["-q", "/dev/null", ...comando] : ["-qec", comando.map((a) => `'${a}'`).join(" "), "/dev/null"];
    const r = spawnSync("script", args, { cwd: RAIZ, env: entornoMinimo({ DATABASE_URL: INALCANZABLE }), encoding: "utf8", timeout: POR_CLI_MS, stdio: ["ignore", "pipe", "pipe"] });
    const texto = `${r.stdout}${r.stderr}`;
    expect(r.status, texto).toBe(2);
    expect(texto).toContain("SALIDA_TERMINAL");
    expect(texto).not.toContain("LISTA_ILEGIBLE");
  });

  it("npm se quedó con --hasta: 2", () => {
    comprobar(correr(EXPORTAR, ["--fondos", join(carpeta, "l.txt"), "--desde", "2024-03-11"], { npm_config_hasta: "2024-03-12" }), 2, "npm se quedó con --hasta");
  });

  it("lista inexistente o que no es regular: 2 con su código, sin la ruta y nada en stdout", () => {
    const s = correr(EXPORTAR, ["--fondos", join(carpeta, "no-existe.txt"), "--desde", "2024-03-11"]);
    comprobar(s, 2, "LISTA_ILEGIBLE");
    expect(s.stdout).toBe("");
    comprobar(correr(EXPORTAR, ["--fondos", carpeta, "--desde", "2024-03-11"]), 2, "LISTA_NO_REGULAR");
  });

  it("lista inválida, sin fondos o demasiado grande: 1 con línea y código, sin repetirlos y nada en stdout", () => {
    const mala = correr(EXPORTAR, ["--fondos", archivo("lista-mala.ficticio.txt", "9990001\n9990001,800\n"), "--desde", "2024-03-11"]);
    comprobar(mala, 1, "línea 2 · FONDO_REPETIDO");
    expect(mala.stdout).toBe("");
    comprobar(correr(EXPORTAR, ["--fondos", archivo("lista-vacia.ficticio.txt", "# nada\n"), "--desde", "2024-03-11"]), 1, "SIN_FONDOS");
    comprobar(correr(EXPORTAR, ["--fondos", archivo("lista-grande.ficticio.txt", "#".repeat(5000)), "--desde", "2024-03-11"]), 1, "LISTA_DEMASIADO_GRANDE");
  });
});
