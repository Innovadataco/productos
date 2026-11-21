// Guardián del esquema (scripts/verificar-esquema.sql): Prisma no ve lo escrito a mano en las migraciones
// (índices parciales, CHECK, EXCLUDE, disparadores, funciones y extensiones) y nadie vigilaba lo que Prisma sí
// crea pero de lo que depende la integridad (índices únicos, llaves primarias y foráneas con su ON DELETE).
// La lista del guardián debe ser EXACTAMENTE la que sale de prisma/migrations: si alguien agrega uno y no lo
// suma, esto se pone rojo. Las definiciones exactas las comprueban contra PostgreSQL real
// tests/integracion/guardian-esquema.test.ts (en el Mac y en el CI) y roles-base.test.ts (solo CI).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { leer008, ruta008 } from "./falsos";

interface Objetos {
  readonly indices: Set<string>;
  readonly restricciones: Set<string>;
  readonly sinValidar: Set<string>;
  readonly llaves: Set<string>;
  readonly llavesSinValidar: Set<string>;
  readonly disparadores: Set<string>;
  readonly funciones: Set<string>;
  readonly extensiones: Set<string>;
}

const migraciones = (): string[] => {
  const dir = ruta008("prisma/migrations");
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((c) => readFileSync(path.join(dir, c, "migration.sql"), "utf8").replace(/--.*$/gm, ""));
};

type Evento = { readonly pos: number; readonly aplicar: (o: Objetos) => void };

/** Los cambios de una migración, en el orden en que aparecen (un DROP seguido de un ADD del mismo nombre deja el objeto). */
function eventos(sql: string): Evento[] {
  const de = (re: RegExp, aplicar: (o: Objetos, m: RegExpMatchArray) => void): Evento[] =>
    [...sql.matchAll(re)].map((m) => ({ pos: m.index ?? 0, aplicar: (o: Objetos) => aplicar(o, m) }));
  return [
    // Índices únicos (de Prisma o a mano) y parciales (a mano).
    ...de(/CREATE\s+UNIQUE\s+INDEX\s+"([^"]+)"/gi, (o, m) => o.indices.add(m[1]!)),
    ...de(/CREATE\s+INDEX\s+"([^"]+)"[^;]*?\bWHERE\b/gi, (o, m) => o.indices.add(m[1]!)),
    // CHECK y EXCLUDE con nombre (también dentro de CREATE TABLE); los NOT VALID quedan aparte hasta su VALIDATE.
    ...de(/CONSTRAINT\s+"([^"]+)"\s+(?:CHECK|EXCLUDE)\b([^;]*)/gi, (o, m) => {
      o.restricciones.add(m[1]!);
      if (/\bNOT\s+VALID\b/i.test(m[2]!)) o.sinValidar.add(m[1]!);
    }),
    // Llaves primarias y foráneas (Prisma las crea; su ON DELETE y ON UPDATE van en la definición).
    ...de(/CONSTRAINT\s+"([^"]+)"\s+(?:PRIMARY\s+KEY|FOREIGN\s+KEY)\b([^;]*)/gi, (o, m) => {
      o.llaves.add(m[1]!);
      if (/\bNOT\s+VALID\b/i.test(m[2]!)) o.llavesSinValidar.add(m[1]!);
    }),
    ...de(/VALIDATE\s+CONSTRAINT\s+"([^"]+)"/gi, (o, m) => {
      o.sinValidar.delete(m[1]!);
      o.llavesSinValidar.delete(m[1]!);
    }),
    ...de(/CREATE\s+TRIGGER\s+"([^"]+)"/gi, (o, m) => o.disparadores.add(m[1]!)),
    ...de(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"([^"]+)"/gi, (o, m) => o.funciones.add(m[1]!)),
    ...de(/CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/gi, (o, m) => o.extensiones.add(m[1]!)),
    ...de(/DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi, (o, m) => o.indices.delete(m[1]!)),
    ...de(/DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi, (o, m) => {
      for (const s of [o.restricciones, o.sinValidar, o.llaves, o.llavesSinValidar]) s.delete(m[1]!);
    }),
    ...de(/DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi, (o, m) => o.disparadores.delete(m[1]!)),
    ...de(/DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi, (o, m) => o.funciones.delete(m[1]!)),
  ].sort((a, b) => a.pos - b.pos);
}

/** Recorre las migraciones en orden y devuelve lo que sigue vivo al final. */
function desdeMigraciones(): Objetos {
  const o: Objetos = {
    indices: new Set(), restricciones: new Set(), sinValidar: new Set(), llaves: new Set(), llavesSinValidar: new Set(),
    disparadores: new Set(), funciones: new Set(), extensiones: new Set(),
  };
  for (const sql of migraciones()) for (const e of eventos(sql)) e.aplicar(o);
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
/** Elementos de una lista plana de textos: ARRAY['a', 'b']. */
const planos = (lista: string): string[] => [...bloque(lista).matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]!);

describe("verificar-esquema.sql coincide con las migraciones", () => {
  const esperado = desdeMigraciones();
  const casos: Array<[string, Set<string>, 1 | 2]> = [
    ["indices", esperado.indices, 2],
    ["restricciones", esperado.restricciones, 2],
    ["llaves", esperado.llaves, 2],
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

  it("indices: trae cada índice único de Prisma del que depende la idempotencia, y los del TOTP", () => {
    expect(nombres("indices", 2)).toEqual(
      expect.arrayContaining([
        "fila_fuente_tipoFuente_claveNatural_ocurrencia_key",
        "orden_filaFuenteId_key",
        "dividendo_filaFuenteId_key",
        "movimiento_caja_filaFuenteId_key",
        "certificacion_fechaCorte_key",
        "lote_ordenId_key",
        "evento_corporativo_tipo_origenId_destinoId_fecha_key",
        "codigo_recuperacion_codigoHash_key",
        "token_acceso_tokenHash_key",
      ]),
    );
  });

  it("sin_validar: justo los CHECK que nacen NOT VALID y ninguna migración valida todavía", () => {
    const enGuardian = planos("sin_validar");
    expect(new Set(enGuardian).size).toBe(enGuardian.length);
    expect([...enGuardian].sort()).toEqual([...esperado.sinValidar].sort());
    for (const nombre of enGuardian) expect(esperado.restricciones.has(nombre), nombre).toBe(true);
  });

  it("toda FK que se agrega NOT VALID se valida en la misma migración (el guardián las exige validadas)", () => {
    expect([...esperado.llavesSinValidar]).toEqual([]);
  });

  it("extensiones: las mismas que crean las migraciones (btree_gist y citext)", () => {
    const enGuardian = planos("extensiones");
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

  it("compara definiciones exactas, validación, índices vivos, disparadores exactos y sin sobrantes, y el md5 de las funciones", () => {
    for (const patron of [
      /pg_get_indexdef/, /indisunique/, /indisvalid/, /indisready/, /indislive/,
      /pg_get_constraintdef/, /convalidated/, /contype IN \('c', 'x'\)/, /contype IN \('p', 'f'\)/,
      /pg_get_triggerdef/, /tgisinternal/, /tgenabled/, /habilitado NOT IN \('O', 'A'\)/,
      /md5\(p\.prosrc\)/, /pg_extension/, /RAISE EXCEPTION/,
    ]) {
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
