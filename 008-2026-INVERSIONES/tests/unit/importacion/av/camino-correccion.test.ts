// Candado (frente certificacion-corte-real): el retiro de una certificación y el paso de una carga a REVERTIDO se
// escriben por UN solo camino, src/importacion/av/corregir.ts (una transacción con sus candados y la re-verificación
// de los cierres). Un segundo camino podría retirar sin reemplazo del mismo archivo o revertir sin retirar.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const EXTENSIONES = /\.(ts|tsx|mts|cts|js|mjs|cjs|sh|sql)$/;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : EXTENSIONES.test(n) ? [p] : [];
  });
}

const escriben = (patron: RegExp) =>
  ["src", "scripts"]
    .flatMap((d) => archivos(path.join(RAIZ, d)))
    .filter((a) => patron.test(readFileSync(a, "utf8")))
    .map((a) => path.relative(RAIZ, a).split(path.sep).join("/"));

describe("retiro y reversión · un solo camino", () => {
  it("solo corregir.ts escribe retiradaEn o reemplazadaPorId", () => {
    expect(escriben(/data\s*:\s*\{[^}]*\b(retiradaEn|reemplazadaPorId)\b/)).toEqual(["src/importacion/av/corregir.ts"]);
  });

  it("solo corregir.ts pasa una carga a REVERTIDO (ni revertidaEn ni revertidaPorId en otro lado)", () => {
    expect(escriben(/data\s*:\s*\{[^}]*(\bREVERTIDO\b|\brevertidaEn\b|\brevertidaPorId\b)/)).toEqual(["src/importacion/av/corregir.ts"]);
  });

  it("ni con SQL crudo", () => {
    expect(escriben(/UPDATE\s+"?(certificacion|carga_archivo)"?\s+SET/i)).toEqual([]);
  });
});
