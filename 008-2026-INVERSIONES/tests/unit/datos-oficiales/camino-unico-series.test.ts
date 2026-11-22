// Candado del camino ÚNICO de escritura de valor_serie_oficial (fase C, C2a): solo src/datos-oficiales/series/guardar.ts
// inserta (createMany) y retira (updateMany); lo usan `importar-series` (el CSV de la vía B) y, después, los demás
// caminos de la fase C. Un segundo camino saltaría la comparación con el vigente (reimportar no escribe), el retiro de
// lo que se solapa en la misma transacción que su reemplazo o el reintento ante otra corrida (P2002 y 23P01). Recorre
// src/ Y scripts/ (el de precios solo recorre src/), en lista blanca: fuera de guardar.ts el delegado solo se puede
// leer (find*, count, groupBy, aggregate), y ningún archivo lo guarda en una variable, lo desestructura, lo nombra entre
// corchetes ni escribe la tabla con SQL crudo (INSERT, UPDATE, DELETE, TRUNCATE, COPY, ALTER).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.join(__dirname, "..", "..", "..");
const GUARDAR = "src/datos-oficiales/series/guardar.ts";
const LECTURAS = new Set(["findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "groupBy", "aggregate"]);
const ESCRITURAS_DE_GUARDAR = new Set(["createMany", "updateMany"]);
/** Cada aparición del delegado con lo que le sigue: `.operacion` o cualquier otra cosa (alias, corchetes, desestructuración). */
const DELEGADO = /\bvalorSerieOficial\b(\s*\.\s*(\w+))?/g;
const SQL_CRUDO = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?|COPY|ALTER\s+TABLE)\s+(?:ONLY\s+)?(?:IF\s+EXISTS\s+)?(?:"?public"?\s*\.\s*)?"?valor_serie_oficial\b/i;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.([cm]?[jt]sx?|sh|sql)$/.test(n) ? [p] : [];
  });
}

const relativo = (a: string) => path.relative(RAIZ, a).split(path.sep).join("/");
const todos = () => ["src", "scripts"].flatMap((d) => archivos(path.join(RAIZ, d)));

/** «archivo · uso» de cada aparición que no es una lectura permitida (en guardar.ts, tampoco sus dos escrituras). */
function usosNoPermitidos(archivo: string, codigo: string): string[] {
  return [...codigo.matchAll(DELEGADO)].flatMap((m) => {
    const operacion = m[2];
    if (operacion && LECTURAS.has(operacion)) return [];
    if (operacion && archivo === GUARDAR && ESCRITURAS_DE_GUARDAR.has(operacion)) return [];
    return [`${archivo} · ${operacion ?? "sin operación"}`];
  });
}

describe("valor_serie_oficial · un solo camino de escritura (src y scripts)", () => {
  it("solo guardar.ts inserta y retira, y lo hace por createMany y updateMany", () => {
    const usos = new Set<string>();
    for (const a of todos()) {
      for (const m of readFileSync(a, "utf8").matchAll(DELEGADO)) if (m[2] && ESCRITURAS_DE_GUARDAR.has(m[2])) usos.add(`${relativo(a)} ${m[2]}`);
    }
    expect([...usos].sort()).toEqual([`${GUARDAR} createMany`, `${GUARDAR} updateMany`]);
  });

  it("fuera de esas dos escrituras, el delegado solo se lee: ni otra operación, ni alias, ni corchetes, ni desestructuración", () => {
    expect(todos().flatMap((a) => usosNoPermitidos(relativo(a), readFileSync(a, "utf8")))).toEqual([]);
  });

  it("ningún módulo ni script escribe la tabla con SQL crudo", () => {
    expect(todos().filter((a) => SQL_CRUDO.test(readFileSync(a, "utf8"))).map(relativo)).toEqual([]);
  });

  it("control positivo: los detectores reconocen cada forma de escribir", () => {
    for (const codigo of [
      "tx.valorSerieOficial.create({", "db.valorSerieOficial.upsert({", "tx.valorSerieOficial.delete({", "db.valorSerieOficial.deleteMany({",
      "tx.valorSerieOficial.createManyAndReturn({", "db.valorSerieOficial.update({", "const v = tx.valorSerieOficial;", "const { valorSerieOficial } = tx;",
      'tx["valorSerieOficial"].createMany({', "tx.valorSerieOficial . createMany({",
    ]) {
      expect(usosNoPermitidos("src/otro.ts", codigo), codigo).not.toEqual([]);
    }
    for (const sql of [
      'INSERT INTO "valor_serie_oficial" ("id") VALUES', "INSERT INTO public.valor_serie_oficial", 'UPDATE "public"."valor_serie_oficial" SET',
      "DELETE FROM valor_serie_oficial", "TRUNCATE valor_serie_oficial", "TRUNCATE TABLE ONLY public.valor_serie_oficial", "COPY valor_serie_oficial FROM",
      'ALTER TABLE "valor_serie_oficial" DISABLE TRIGGER ALL', "update valor_serie_oficial set",
    ]) {
      expect(SQL_CRUDO.test(sql), sql).toBe(true);
    }
  });

  it("control negativo: las lecturas, las escrituras de guardar.ts y lo que solo nombra la tabla no muerden", () => {
    for (const codigo of ["db.valorSerieOficial.findMany({", "tx.valorSerieOficial.findFirst({", "db.valorSerieOficial.count({", "Prisma.ValorSerieOficialWhereInput"]) {
      expect(usosNoPermitidos("src/otro.ts", codigo), codigo).toEqual([]);
    }
    expect(usosNoPermitidos(GUARDAR, "tx.valorSerieOficial.createMany({ tx.valorSerieOficial.updateMany({")).toEqual([]);
    for (const sql of [
      "CREATE TRIGGER valor_serie_oficial_retiro BEFORE INSERT OR DELETE OR UPDATE ON public.valor_serie_oficial FOR EACH ROW",
      "SELECT count(*) FROM valor_serie_oficial", "INSERT INTO valor_serie_oficial_viejo",
    ]) {
      expect(SQL_CRUDO.test(sql), sql).toBe(false);
    }
  });
});
