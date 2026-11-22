// Candado del camino ÚNICO de los rendimientos del fondo (frente fondo-rendimientos, T3): solo
// src/fondo/rendimientos/guardar.ts crea los hechos de rendimiento_fondo, y lo hace en la misma transacción que su ajuste
// de caja y su fila cruda, con el candado del fondo. Otro camino podría dejar un ajuste RENDIMIENTO_FIC sin su hecho (o
// al revés), que la conciliación contaría en la caja sin saber de dónde salió. También: el tipo de fuente
// REGISTRO_RENDIMIENTOS_FIC solo aparece en src/fondo/rendimientos/, y cada categoría de caja del fondo tiene un solo
// dueño (RENDIMIENTO_FIC, guardar.ts; APORTE_FIC, src/fondo/movimiento.ts). Recorre src/ y scripts/.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const CARPETAS = ["src", "scripts"].map((c) => path.join(RAIZ, c));
const ESCRITURA = /\brendimientoFondo\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\b/g;
/** SQL crudo que escriba en rendimiento_fondo, o un alias del delegado: tampoco. */
const ESCRITURA_CRUDA = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|COPY)\s+(?:"?public"?\s*\.\s*)?"?rendimiento_fondo\b|=\s*\w+\.rendimientoFondo\s*;|\{\s*rendimientoFondo\s*\}\s*=/i;
const TIPO_FUENTE = /\bREGISTRO_RENDIMIENTOS_FIC\b/;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx|mts|cts|js|mjs|cjs|sh|sql)$/.test(n) ? [p] : [];
  });
}

const todos = () => CARPETAS.flatMap(archivos);
const relativo = (a: string) => path.relative(RAIZ, a).split(path.sep).join("/");
const GUARDAR = "src/fondo/rendimientos/guardar.ts";

/** Los archivos (de src/ y scripts/) cuyo código contiene el literal entre comillas. */
const conLiteral = (literal: string) => todos().filter((a) => readFileSync(a, "utf8").includes(`"${literal}"`)).map(relativo).sort();

describe("rendimiento_fondo · un solo camino de escritura", () => {
  it("solo src/fondo/rendimientos/guardar.ts crea hechos; nada los edita ni los borra", () => {
    const usos = new Set<string>();
    for (const a of todos()) for (const m of readFileSync(a, "utf8").matchAll(ESCRITURA)) usos.add(`${relativo(a)} ${m[1]}`);
    expect([...usos].sort()).toEqual([`${GUARDAR} create`]);
  });

  it("ningún módulo ni script escribe con SQL crudo ni guarda el delegado en una variable", () => {
    expect(todos().filter((a) => ESCRITURA_CRUDA.test(readFileSync(a, "utf8"))).map(relativo)).toEqual([]);
  });

  it("REGISTRO_RENDIMIENTOS_FIC solo aparece en src/fondo/rendimientos/", () => {
    expect(todos().filter((a) => TIPO_FUENTE.test(readFileSync(a, "utf8"))).map(relativo).filter((a) => !a.startsWith("src/fondo/rendimientos/"))).toEqual([]);
  });

  it("cada categoría de caja del fondo tiene un solo dueño: RENDIMIENTO_FIC en guardar.ts y APORTE_FIC en movimiento.ts", () => {
    expect(conLiteral("RENDIMIENTO_FIC")).toEqual([GUARDAR]);
    expect(conLiteral("APORTE_FIC")).toEqual(["src/fondo/movimiento.ts"]);
  });

  it("control positivo: los detectores reconocen una escritura", () => {
    expect([..."tx.rendimientoFondo.createMany({".matchAll(ESCRITURA)].map((m) => m[1])).toEqual(["createMany"]);
    expect([..."db.rendimientoFondo . upsert(".matchAll(ESCRITURA)].map((m) => m[1])).toEqual(["upsert"]);
    expect(ESCRITURA_CRUDA.test('INSERT INTO "rendimiento_fondo" ("id") VALUES')).toBe(true);
    expect(ESCRITURA_CRUDA.test("DELETE FROM public.rendimiento_fondo")).toBe(true);
    expect(ESCRITURA_CRUDA.test("const r = tx.rendimientoFondo;")).toBe(true);
    expect(ESCRITURA_CRUDA.test("const { rendimientoFondo } = tx;")).toBe(true);
    expect(ESCRITURA_CRUDA.test("db.rendimientoFondo.findMany({")).toBe(false);
    expect(ESCRITURA_CRUDA.test("BEFORE UPDATE OR DELETE ON public.rendimiento_fondo")).toBe(false);
    expect(TIPO_FUENTE.test('tipoFuente: "REGISTRO_RENDIMIENTOS_FIC"')).toBe(true);
  });
});
