// Candado del camino ÚNICO de escritura de dividendo_decretado (fase C, C4a): solo src/datos-oficiales/decretos/guardar.ts
// crea (create) y retira (updateMany) decretos. La base no impone la cadena de versiones (condición de C1): un segundo
// camino podría dejar una v2 sin v1, un número que no sigue al anterior o un retiro sin sucesor. También: el tipo de
// fuente REGISTRO_DECRETOS solo aparece en
// src/datos-oficiales/decretos/ (ninguna otra carga crea filas crudas de decretos). Recorre src/ y scripts/.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const CARPETAS = ["src", "scripts"].map((c) => path.join(RAIZ, c));
const ESCRITURA = /\bdividendoDecretado\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\b/g;
/** SQL crudo que escriba en dividendo_decretado, o un alias del delegado (`const d = tx.dividendoDecretado`): tampoco. */
const ESCRITURA_CRUDA = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?dividendo_decretado\b|=\s*\w+\.dividendoDecretado\s*;|\{\s*dividendoDecretado\s*\}\s*=/i;
const TIPO_FUENTE = /\bREGISTRO_DECRETOS\b/;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(n) ? [p] : [];
  });
}

const todos = () => CARPETAS.flatMap(archivos);
const relativo = (a: string) => path.relative(RAIZ, a);

function escrituras(): Record<string, string[]> {
  const usos: Record<string, Set<string>> = {};
  for (const archivo of todos()) {
    for (const m of readFileSync(archivo, "utf8").matchAll(ESCRITURA)) (usos[m[1]!] ??= new Set()).add(relativo(archivo));
  }
  return Object.fromEntries(Object.entries(usos).map(([op, set]) => [op, [...set].sort()]));
}

describe("dividendo_decretado · un solo camino de escritura", () => {
  it("solo src/datos-oficiales/decretos/guardar.ts crea y retira; nada más escribe", () => {
    const guardar = path.join("src", "datos-oficiales", "decretos", "guardar.ts");
    expect(escrituras()).toEqual({ create: [guardar], updateMany: [guardar] });
  });

  it("ningún módulo ni script escribe con SQL crudo ni guarda el delegado en una variable", () => {
    expect(todos().filter((a) => ESCRITURA_CRUDA.test(readFileSync(a, "utf8"))).map(relativo)).toEqual([]);
  });

  it("REGISTRO_DECRETOS solo aparece en src/datos-oficiales/decretos/", () => {
    const fuera = todos().filter((a) => TIPO_FUENTE.test(readFileSync(a, "utf8"))).map(relativo).filter((a) => !a.startsWith(path.join("src", "datos-oficiales", "decretos") + path.sep));
    expect(fuera).toEqual([]);
  });

  it("control positivo: los detectores reconocen una escritura", () => {
    expect([..."tx.dividendoDecretado.createMany({".matchAll(ESCRITURA)].map((m) => m[1])).toEqual(["createMany"]);
    expect([..."db.dividendoDecretado . upsert(".matchAll(ESCRITURA)].map((m) => m[1])).toEqual(["upsert"]);
    expect(ESCRITURA_CRUDA.test('INSERT INTO "dividendo_decretado" ("id") VALUES')).toBe(true);
    expect(ESCRITURA_CRUDA.test('UPDATE dividendo_decretado SET "reemplazadoEn" = now()')).toBe(true);
    expect(ESCRITURA_CRUDA.test("const d = tx.dividendoDecretado;")).toBe(true);
    expect(ESCRITURA_CRUDA.test("const { dividendoDecretado } = tx;")).toBe(true);
    expect(ESCRITURA_CRUDA.test("db.dividendoDecretado.findMany({")).toBe(false);
    expect(TIPO_FUENTE.test('tipoFuente: "REGISTRO_DECRETOS"')).toBe(true);
  });
});
