// scripts/contar-sin-validar.sql: lo corre el dueño contra su base, antes de la migración que valide los CHECK
// nacidos NOT VALID. Debe ser de solo lectura (transacción READ ONLY que se deshace), devolver solo conteos
// y contar con la MISMA expresión del CHECK de la migración, para cada nombre de `sin_validar` del guardián.
// Que cuente bien contra PostgreSQL lo prueba tests/integracion/reglas-esquema.test.ts.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { leer008, ruta008 } from "./falsos";

const crudo = leer008("scripts/contar-sin-validar.sql");
const sql = crudo.replace(/--.*$/gm, "");
const sinValidar = [...(/\bsin_validar\s+text\[\]\s*:=\s*ARRAY\[([^\]]*)\];/.exec(leer008("scripts/verificar-esquema.sql"))?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]!);

/** La expresión de cada CHECK NOT VALID, tal como la escribe su migración. */
function checksDeMigraciones(): Map<string, string> {
  const dir = ruta008("prisma/migrations");
  const mapa = new Map<string, string>();
  for (const carpeta of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const texto = readFileSync(path.join(dir, carpeta.name, "migration.sql"), "utf8").replace(/--.*$/gm, "");
    for (const m of texto.matchAll(/CONSTRAINT\s+"([^"]+)"\s+CHECK\s+([\s\S]*?)\s+NOT\s+VALID\s*;/g)) mapa.set(m[1]!, m[2]!.trim());
  }
  return mapa;
}

describe("contar-sin-validar.sql", () => {
  it("corre en una transacción READ ONLY que se deshace, con una sola consulta en medio", () => {
    const sentencias = sql.split(";").map((s) => s.trim()).filter(Boolean);
    expect(sentencias[0]).toMatch(/^BEGIN\s+TRANSACTION\s+READ\s+ONLY$/i);
    expect(sentencias.at(-1)).toMatch(/^ROLLBACK$/i);
    expect(sentencias).toHaveLength(3);
    expect(sentencias[1]).toMatch(/^SELECT\b/i);
  });

  it("no escribe ni cambia nada (ni datos ni esquema)", () => {
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|VALIDATE|COPY|COMMIT|SET)\b/i);
  });

  it("devuelve solo conteos: count(*) por restricción, nunca columnas de las filas", () => {
    const consulta = sql.split(";")[1] ?? "";
    expect(consulta).not.toMatch(/SELECT\s+\*/i);
    for (const m of consulta.matchAll(/SELECT\s+'([a-z_]+)'(?:\s+AS\s+restriccion)?\s*,\s*([^\n]+?)\s+FROM\s+"([a-z_]+)"/gi)) {
      expect(m[2], m[1]).toMatch(/^count\(\*\) FILTER \(WHERE NOT \(/);
    }
  });

  it("cubre exactamente los CHECK de sin_validar del guardián, con la misma expresión que su migración", () => {
    expect(sinValidar.length).toBeGreaterThan(0);
    const checks = checksDeMigraciones();
    const consulta = sql.split(";")[1] ?? "";
    const enScript = [...consulta.matchAll(/SELECT\s+'([a-z_]+)'/gi)].map((m) => m[1]!);
    expect([...enScript].sort()).toEqual([...sinValidar].sort());
    for (const nombre of sinValidar) {
      const expresion = checks.get(nombre);
      expect(expresion, nombre).toBeDefined();
      expect(consulta, nombre).toContain(`'${nombre}'`);
      const linea = consulta.split("\n").find((l) => l.includes(`'${nombre}'`)) ?? "";
      expect(linea.replace(/\s+/g, " "), nombre).toContain(`WHERE NOT ${expresion!.replace(/\s+/g, " ")})`);
    }
  });

  it("dice cómo correrlo en el Mac y en el VPS, y que el VALIDATE va en una migración, nunca a mano", () => {
    expect(crudo).toMatch(/psql .*-f scripts\/contar-sin-validar\.sql/);
    expect(crudo).toMatch(/inv-008-db psql .*-U inv_dueno -d inversiones/);
    expect(crudo).toMatch(/migración posterior/);
  });
});
