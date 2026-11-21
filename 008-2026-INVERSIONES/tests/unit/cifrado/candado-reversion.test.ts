// Candado (#11): el bypass del disparador de solo inserción (`inv.reversion`) lo usa una sola ruta
// del código de la app y de los scripts: la migración de datos que cifra lo existente.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const EXTENSIONES = /\.(ts|tsx|mts|cts|js|mjs|cjs|sh|sql)$/;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return EXTENSIONES.test(nombre) ? [ruta] : [];
  });
}

describe("candado del bypass inv.reversion", () => {
  it("en src/ y scripts/ solo lo usa src/cifrado/migracion.ts", () => {
    const usan = ["src", "scripts"]
      .flatMap((d) => archivos(join(RAIZ, d)))
      .filter((ruta) => readFileSync(ruta, "utf8").includes("inv.reversion"))
      .map((ruta) => relative(RAIZ, ruta).split("\\").join("/"));
    expect(usan).toEqual(["src/cifrado/migracion.ts"]);
  });
});
