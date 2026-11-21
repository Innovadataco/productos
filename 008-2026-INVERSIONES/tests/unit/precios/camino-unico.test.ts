// Candado del camino ÚNICO de escritura de precio_cierre: `precios:actualizar` (Yahoo) y `precios:importar`
// (el CSV de cierres) escriben por src/precios/guardar.ts y por nada más. La depuración (SPEC-13) solo retira
// vigentes (updateMany con guarda). Un segundo camino de inserción saltaría la guarda de versión (#1002), las
// omisiones (#1005) o la re-verificación (#1007).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(__dirname, "..", "..", "..", "src");
const ESCRITURA = /\bprecioCierre\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

/** Operación → archivos (relativos a src) que la usan. */
function escrituras(): Record<string, string[]> {
  const usos: Record<string, Set<string>> = {};
  for (const archivo of archivos(SRC)) {
    for (const m of readFileSync(archivo, "utf8").matchAll(ESCRITURA)) {
      (usos[m[1]!] ??= new Set()).add(path.relative(SRC, archivo));
    }
  }
  return Object.fromEntries(Object.entries(usos).map(([op, set]) => [op, [...set].sort()]));
}

describe("precio_cierre · un solo camino de escritura", () => {
  it("solo guardar.ts inserta y reemplaza; depurar.ts solo retira; nada más escribe", () => {
    expect(escrituras()).toEqual({
      create: [path.join("precios", "guardar.ts")],
      updateMany: [path.join("precios", "depurar.ts"), path.join("precios", "guardar.ts")].sort(),
    });
  });
});
