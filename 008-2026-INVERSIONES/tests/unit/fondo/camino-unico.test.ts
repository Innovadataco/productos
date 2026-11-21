// Candado del camino ÚNICO de escritura de valor_unidad_fondo: `actualizar-fondo` (la SFC) e
// `importar-valores-fondo` (el CSV de la vía B) escriben por src/fondo/guardar.ts y por nada más. Un segundo
// camino de inserción saltaría el versionado (`reemplazadoEn`), la comparación con el vigente (reimportar el mismo
// dato no escribe) o el reintento ante otra corrida (P2002 por el índice parcial único).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..");
const CARPETAS = ["src", "scripts"].map((c) => path.join(RAIZ, c));
const ESCRITURA = /\bvalorUnidadFondo\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g;
/** SQL crudo que escriba en valor_unidad_fondo, o un alias del delegado (`const v = tx.valorUnidadFondo`): tampoco. */
const ESCRITURA_CRUDA = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?valor_unidad_fondo\b|=\s*\w+\.valorUnidadFondo\s*;/i;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx|mts)$/.test(n) ? [p] : [];
  });
}

const todos = () => CARPETAS.flatMap(archivos);

/** Operación → archivos (relativos a la raíz de 008) que la usan. */
function escrituras(): Record<string, string[]> {
  const usos: Record<string, Set<string>> = {};
  for (const archivo of todos()) {
    for (const m of readFileSync(archivo, "utf8").matchAll(ESCRITURA)) {
      (usos[m[1]!] ??= new Set()).add(path.relative(RAIZ, archivo));
    }
  }
  return Object.fromEntries(Object.entries(usos).map(([op, set]) => [op, [...set].sort()]));
}

describe("valor_unidad_fondo · un solo camino de escritura", () => {
  it("ningún módulo ni script escribe con SQL crudo ni guarda el delegado en una variable", () => {
    const hallados = todos().filter((a) => ESCRITURA_CRUDA.test(readFileSync(a, "utf8"))).map((a) => path.relative(RAIZ, a));
    expect(hallados).toEqual([]);
  });

  it("solo src/fondo/guardar.ts inserta y reemplaza; nada más escribe", () => {
    const guardar = path.join("src", "fondo", "guardar.ts");
    expect(escrituras()).toEqual({ createMany: [guardar], updateMany: [guardar] });
  });

  it("control positivo: los detectores reconocen una escritura", () => {
    expect([..."tx.valorUnidadFondo.createMany({".matchAll(ESCRITURA)].map((m) => m[1])).toEqual(["createMany"]);
    expect(ESCRITURA_CRUDA.test('INSERT INTO "valor_unidad_fondo" ("id") VALUES')).toBe(true);
    expect(ESCRITURA_CRUDA.test("const v = tx.valorUnidadFondo;")).toBe(true);
    expect(ESCRITURA_CRUDA.test("db.valorUnidadFondo.findFirst({")).toBe(false);
  });
});
