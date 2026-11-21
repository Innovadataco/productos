// `precios:importar` y `precios:exportar` como proceso, sin base y sin red: los errores de uso salen con 2 y los
// de contenido con 1, ANTES de tocar la base (o la red); ninguno imprime nemotécnicos, precios, fechas ni rutas.
// La base es inalcanzable a propósito (puerto 1 de 127.0.0.1). El entorno del hijo es mínimo. stdout y stderr se
// miran por separado (el CSV del exportador va a stdout). Especies FICT y cifras inventadas.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { POR_CLI_MS, RAIZ, entornoMinimo } from "../../ayudas/cli";
import { MAX_BYTES_CSV } from "@/precios/csv-cierres";

const TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const INALCANZABLE = "postgresql://ficticio:clave-ficticia@127.0.0.1:1/inalcanzable_test";
const NUNCA = ["127.0.0.1", "clave-ficticia", "postgresql://", "inalcanzable_test", "FICTQ", "4321.5", "2024-03-11", "carpeta-ficticia"];
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
  if (codigo !== 1 || !esperado.includes("falló")) expect(texto, "no debía tocar la base").not.toContain("PrismaClient");
}
const archivo = (nombre: string, contenido: string | Uint8Array) => {
  const ruta = join(carpeta, nombre);
  writeFileSync(ruta, contenido);
  return ruta;
};
const ENCABEZADO = "nemotecnico,fecha,cierre,volumen";

describe("precios:importar · como proceso, sin base", { timeout: 8 * POR_CLI_MS }, () => {
  const USO = "Uso: npm run -s precios:importar -- --archivo";

  it("argumentos inválidos (ninguno, --ayuda, posicional, --archivo sin ruta): 2 con su uso", () => {
    comprobar(correr("importar-precios.ts", []), 2, USO);
    comprobar(correr("importar-precios.ts", ["--ayuda"]), 2, USO);
    comprobar(correr("importar-precios.ts", [join(carpeta, "x.csv")]), 2, USO);
    comprobar(correr("importar-precios.ts", ["--archivo"]), 2, USO);
  });

  it("npm se quedó con --archivo: 2", () => {
    comprobar(correr("importar-precios.ts", [], { npm_config_archivo: join(carpeta, "x.csv") }), 2, "npm se quedó con --archivo");
  });

  it("archivo inexistente o que no es regular: 2 con su código, sin la ruta", () => {
    comprobar(correr("importar-precios.ts", ["--archivo", join(carpeta, "no-existe.csv")]), 2, "ARCHIVO_ILEGIBLE");
    comprobar(correr("importar-precios.ts", ["--archivo", carpeta]), 2, "ARCHIVO_NO_REGULAR");
  });

  it(`más de ${MAX_BYTES_CSV} bytes: 1 CSV_DEMASIADO_GRANDE`, () => {
    comprobar(correr("importar-precios.ts", ["--archivo", archivo("grande.ficticio.csv", new Uint8Array(MAX_BYTES_CSV + 1).fill(0x41))]), 1, "CSV_DEMASIADO_GRANDE");
  });

  it("CSV inválido: 1 con línea y código, sin abrir la base y sin repetir valores", () => {
    const ruta = archivo("malo.ficticio.csv", `${ENCABEZADO}\nFICTQ,2024-03-11,4321.5,1\nFICTQ,2024-03-11,0,1\n`);
    const s = correr("importar-precios.ts", ["--archivo", ruta]);
    comprobar(s, 1, "CSV_INVALIDO");
    expect(s.stderr).toContain("línea 3 · CIERRE_FUERA_DE_RANGO");
  });

  it("CSV válido con la base inalcanzable: 1 con solo el nombre del error", () => {
    const ruta = archivo("bueno.ficticio.csv", `${ENCABEZADO}\nFICTQ,2024-03-11,4321.5,1\n`);
    comprobar(correr("importar-precios.ts", ["--archivo", ruta]), 1, "❌ La importación de precios falló: PrismaClientInitializationError");
  });
});

describe("precios:exportar · como proceso, sin red (todos los casos terminan antes de pedir a Yahoo)", { timeout: 8 * POR_CLI_MS }, () => {
  const USO = "Uso: npm run -s precios:exportar -- --nemos";

  it("argumentos inválidos (ninguno, --ayuda, sin --desde, rango al revés): 2 con su uso y nada en stdout", () => {
    for (const args of [[], ["--ayuda"], ["--nemos", join(carpeta, "l.txt")], ["--nemos", join(carpeta, "l.txt"), "--desde", "2024-03-12", "--hasta", "2024-03-11"]]) {
      const s = correr("exportar-precios.ts", args);
      comprobar(s, 2, USO);
      expect(s.stdout).toBe("");
    }
  });

  it("npm se quedó con --hasta: 2", () => {
    comprobar(correr("exportar-precios.ts", ["--nemos", join(carpeta, "l.txt"), "--desde", "2024-03-11"], { npm_config_hasta: "2024-03-12" }), 2, "npm se quedó con --hasta");
  });

  it("lista inexistente o que no es regular: 2 con su código, sin la ruta y nada en stdout", () => {
    const s = correr("exportar-precios.ts", ["--nemos", join(carpeta, "no-existe.txt"), "--desde", "2024-03-11"]);
    comprobar(s, 2, "LISTA_ILEGIBLE");
    expect(s.stdout).toBe("");
    comprobar(correr("exportar-precios.ts", ["--nemos", carpeta, "--desde", "2024-03-11"]), 2, "LISTA_NO_REGULAR");
  });

  it("lista inválida o sin nemotécnicos: 1 con línea y código, sin repetirlos y nada en stdout", () => {
    const mala = correr("exportar-precios.ts", ["--nemos", archivo("lista-mala.ficticio.txt", "FICTQ\nfictq\n"), "--desde", "2024-03-11"]);
    comprobar(mala, 1, "línea 2 · NEMOTECNICO_FORMATO");
    expect(mala.stdout).toBe("");
    comprobar(correr("exportar-precios.ts", ["--nemos", archivo("lista-vacia.ficticio.txt", "# nada\n"), "--desde", "2024-03-11"]), 1, "SIN_NEMOS");
  });
});
