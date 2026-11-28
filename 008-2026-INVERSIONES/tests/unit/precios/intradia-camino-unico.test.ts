// Candado del camino ÚNICO de escritura de precio_intradia: solo `src/precios/intradia/guardar.ts` inserta (sin duplicar,
// con ON CONFLICT DO NOTHING) y solo `src/precios/intradia/depurar.ts` borra (la retención). Nada actualiza. Un segundo
// camino saltaría los topes y la deduplicación. Con control positivo: el detector muerde un caso plantado.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(__dirname, "..", "..", "..", "src");
const ESCRITURA = /\bprecioIntradia\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g;
const ESCRITURA_CRUDA = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?precio_intradia\b|=\s*\w+\.precioIntradia\s*;/i;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const p = path.join(dir, nombre);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx)$/.test(nombre) ? [p] : [];
  });
}

function escrituras(): Record<string, string[]> {
  const usos: Record<string, Set<string>> = {};
  for (const archivo of archivos(SRC)) {
    for (const m of readFileSync(archivo, "utf8").matchAll(ESCRITURA)) (usos[m[1]!] ??= new Set()).add(path.relative(SRC, archivo));
  }
  return Object.fromEntries(Object.entries(usos).map(([op, set]) => [op, [...set].sort()]));
}

describe("precio_intradia · un solo camino de escritura", () => {
  it("solo guardar.ts inserta (createMany) y solo depurar.ts borra (deleteMany); nada actualiza", () => {
    expect(escrituras()).toEqual({
      createMany: [path.join("precios", "intradia", "guardar.ts")],
      deleteMany: [path.join("precios", "intradia", "depurar.ts")],
    });
  });

  it("ningún módulo escribe con SQL crudo ni guarda el delegado en una variable", () => {
    expect(archivos(SRC).filter((a) => ESCRITURA_CRUDA.test(readFileSync(a, "utf8"))).map((a) => path.relative(SRC, a))).toEqual([]);
  });

  it("control positivo: los detectores muerden lo plantado", () => {
    expect([..."db.precioIntradia.create({})".matchAll(ESCRITURA)]).toHaveLength(1);
    expect([..."tx.precioIntradia.updateMany({})".matchAll(ESCRITURA)]).toHaveLength(1);
    expect(ESCRITURA_CRUDA.test('INSERT INTO "precio_intradia" VALUES (1)')).toBe(true);
    expect(ESCRITURA_CRUDA.test("DELETE FROM precio_intradia")).toBe(true);
    expect(ESCRITURA_CRUDA.test("const p = tx.precioIntradia;")).toBe(true);
  });

  it("la app (src/app) no importa el camino de escritura", () => {
    const app = archivos(path.join(SRC, "app")).filter((a) => /precios\/intradia\/(guardar|depurar|ciclo)/.test(readFileSync(a, "utf8")));
    expect(app.map((a) => path.relative(SRC, a))).toEqual([]);
  });
});
