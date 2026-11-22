/**
 * Candado (REV-BAJO-5): el generador falso es solo para pruebas. Ningún módulo de la app, de los scripts ni de las
 * imágenes (`src/`, `scripts/`, `docker/`) lo importa; solo las pruebas. Los especificadores los saca el analizador
 * de TypeScript (import, export … from, import() y require()). Con control positivo: el detector muerde un import.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..");
const CARPETAS = ["src", "scripts", "docker"];
const PROPIO = path.join(RAIZ, "src", "ia", "generador-falso.ts");
const CODIGO = /\.[cm]?[jt]sx?$/;

function archivos(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : CODIGO.test(n) ? [p] : [];
  });
}

/** ¿El código importa el generador falso, por cualquier camino? */
function importaElFalso(codigo: string): boolean {
  return ts.preProcessFile(codigo, true, true).importedFiles.some((f) => /(?:^|\/)generador-falso(?:\.[cm]?[jt]s)?$/.test(f.fileName));
}

describe("candado del generador falso", () => {
  it("el detector muerde cada forma de importarlo (control positivo)", () => {
    expect(importaElFalso('import { crearGeneradorFalso } from "@/ia/generador-falso";')).toBe(true);
    expect(importaElFalso('export * from "../ia/generador-falso.ts";')).toBe(true);
    expect(importaElFalso('const m = await import("./generador-falso");')).toBe(true);
    expect(importaElFalso('const m = require("@/ia/generador-falso");')).toBe(true);
    expect(importaElFalso('import { generarConPuertas } from "@/ia/puertas";')).toBe(false);
    expect(importaElFalso('import x from "@/ia/otro-generador-falso-no";')).toBe(false);
  });

  it("ningún módulo de src, scripts ni docker lo importa", () => {
    const todos = CARPETAS.flatMap((c) => archivos(path.join(RAIZ, c))).filter((p) => p !== PROPIO);
    expect(todos.length).toBeGreaterThan(50);
    const infractores = todos.filter((p) => importaElFalso(readFileSync(p, "utf8"))).map((p) => path.relative(RAIZ, p));
    expect(infractores).toEqual([]);
  });
});
