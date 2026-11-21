// Guardián del esquema (scripts/verificar-esquema.sql): Prisma no ve lo escrito a mano en las migraciones
// (índices parciales, CHECK, EXCLUDE, disparadores, la función de solo inserción y las extensiones). La lista
// del guardián debe ser EXACTAMENTE la que sale de prisma/migrations: si alguien agrega uno y no lo suma,
// esto se pone rojo. Las definiciones exactas las comprueba roles-base.test.ts contra PostgreSQL real.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { leer008, ruta008 } from "./falsos";

type Objetos = { indices: Set<string>; restricciones: Set<string>; disparadores: Set<string>; funciones: Set<string>; extensiones: Set<string> };

const migraciones = (): string[] => {
  const dir = ruta008("prisma/migrations");
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((c) => readFileSync(path.join(dir, c, "migration.sql"), "utf8").replace(/--.*$/gm, ""));
};

/** Recorre las migraciones en orden y devuelve lo escrito a mano que sigue vivo (resta los DROP). */
function desdeMigraciones(): Objetos {
  const o: Objetos = { indices: new Set(), restricciones: new Set(), disparadores: new Set(), funciones: new Set(), extensiones: new Set() };
  for (const sql of migraciones()) {
    for (const m of sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+"([^"]+)"[^;]*?\bWHERE\b/gi)) o.indices.add(m[1]!);
    // También los CHECK y EXCLUDE con nombre dentro de CREATE TABLE, no solo los ADD CONSTRAINT.
    for (const m of sql.matchAll(/(?:ADD\s+)?CONSTRAINT\s+"([^"]+)"\s+(?:CHECK|EXCLUDE)\b/gi)) o.restricciones.add(m[1]!);
    for (const m of sql.matchAll(/CREATE\s+TRIGGER\s+"([^"]+)"/gi)) o.disparadores.add(m[1]!);
    for (const m of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"([^"]+)"/gi)) o.funciones.add(m[1]!);
    for (const m of sql.matchAll(/CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/gi)) o.extensiones.add(m[1]!);
    for (const m of sql.matchAll(/DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi)) o.indices.delete(m[1]!);
    for (const m of sql.matchAll(/DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi)) o.restricciones.delete(m[1]!);
    for (const m of sql.matchAll(/DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi)) o.disparadores.delete(m[1]!);
    for (const m of sql.matchAll(/DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi)) o.funciones.delete(m[1]!);
  }
  return o;
}

const guardian = leer008("scripts/verificar-esquema.sql");
const bloque = (nombre: string): string => {
  const m = new RegExp(`\\b${nombre}\\s+text\\[\\]\\s*:=\\s*ARRAY\\[([\\s\\S]*?)\\];`).exec(guardian);
  if (!m) throw new Error(`falta la lista ${nombre} en verificar-esquema.sql`);
  return m[1]!;
};
/** Nombres de una lista de filas ['tabla', 'nombre', …] (columna 2) o ['nombre', …] (columna 1). */
const nombres = (lista: string, columna: 1 | 2): string[] =>
  [...bloque(lista).matchAll(/\[\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/g)].map((m) => m[columna]!);

describe("verificar-esquema.sql coincide con lo escrito a mano en las migraciones", () => {
  const esperado = desdeMigraciones();
  const casos: Array<[string, Set<string>, 1 | 2]> = [
    ["indices_parciales", esperado.indices, 2],
    ["restricciones", esperado.restricciones, 2],
    ["disparadores", esperado.disparadores, 2],
    ["funciones", esperado.funciones, 1],
  ];
  for (const [lista, conjunto, columna] of casos) {
    it(`${lista}: misma lista, sin repetidos`, () => {
      const enGuardian = nombres(lista, columna);
      expect(conjunto.size).toBeGreaterThan(0);
      expect(new Set(enGuardian).size).toBe(enGuardian.length);
      expect([...enGuardian].sort()).toEqual([...conjunto].sort());
    });
  }

  it("extensiones: las mismas que crean las migraciones (btree_gist y citext)", () => {
    const enGuardian = [...bloque("extensiones").matchAll(/'([^']+)'/g)].map((m) => m[1]!);
    expect(enGuardian.sort()).toEqual([...esperado.extensiones].sort());
    expect(enGuardian).toEqual(expect.arrayContaining(["btree_gist", "citext"]));
  });

  it("las migraciones no traen CHECK sin nombre (el guardián no podría seguirlos)", () => {
    for (const sql of migraciones()) {
      for (const sentencia of sql.split(";")) {
        for (const m of sentencia.matchAll(/\bCHECK\s*\(/gi)) {
          const antes = sentencia.slice(0, m.index).trimEnd();
          expect(antes, sentencia.slice(0, 120)).toMatch(/CONSTRAINT\s+"[^"]+"$/i);
        }
      }
    }
  });

  it("compara definiciones exactas, tabla, tipo, función, habilitación, unicidad y el md5 de la función", () => {
    for (const patron of [/pg_get_indexdef/, /indisunique/, /pg_get_constraintdef/, /convalidated/, /tgrelid/, /tgtype/, /tgfoid/, /habilitado NOT IN \('O', 'A'\)/, /md5\(p\.prosrc\)/, /pg_extension/, /RAISE EXCEPTION/]) {
      expect(guardian).toMatch(patron);
    }
  });

  it("el migrador lo corre después de migrate deploy y antes de los privilegios", () => {
    const migrar = leer008("docker/migrar.sh");
    const a = migrar.indexOf("node_modules/.bin/prisma migrate deploy");
    const b = migrar.indexOf("--file scripts/verificar-esquema.sql");
    const c = migrar.indexOf("--file docker/migrador/privilegios.sql");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });
});
