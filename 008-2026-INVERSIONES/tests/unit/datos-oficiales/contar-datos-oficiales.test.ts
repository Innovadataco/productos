// scripts/contar-datos-oficiales.sql: el conteo de solo lectura que el dueño corre contra la base de producción ANTES
// de desplegar la migración 20261122030100_datos_oficiales. Cuenta lo mismo que su guardia (si todo da 0, la guardia
// pasa; si no, el despliegue quedaría P3009): debe ser de solo lectura, devolver solo conteos y cubrir cada causa.
// Que cuente bien contra PostgreSQL lo prueba tests/integracion/reglas-datos-oficiales.test.ts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR_008 = path.join(__dirname, "..", "..", "..");
const crudo = readFileSync(path.join(DIR_008, "scripts", "contar-datos-oficiales.sql"), "utf8");
const sql = crudo.replace(/--.*$/gm, "");
const migracion = readFileSync(path.join(DIR_008, "prisma", "migrations", "20261122030100_datos_oficiales", "migration.sql"), "utf8");
const guardia = /-- guardia:inicio\n([\s\S]*?)-- guardia:fin/.exec(migracion)?.[1] ?? "";

describe("contar-datos-oficiales.sql", () => {
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

  it("devuelve solo conteos, nunca columnas de las filas", () => {
    const consulta = sql.split(";")[1] ?? "";
    expect(consulta).not.toMatch(/SELECT\s+\*/i);
    const columnas = [...consulta.matchAll(/^\s*(?:SELECT\s+)?(.+?)\s+AS\s+([a-z_]+),?\s*$/gim)];
    expect(columnas.map((m) => m[2])).toEqual(["decretos", "con_monto_bruto", "con_retencion", "con_tasa_retencion", "con_decreto_enlazado"]);
    for (const m of columnas) expect(m[1], m[2]).toMatch(/^\(?\s*(SELECT )?count\(\*\)/);
  });

  it("cuenta las mismas causas que la guardia de la migración", () => {
    expect(guardia).not.toBe("");
    for (const condicion of ['FROM "dividendo_decretado"', '"montoBruto" IS NOT NULL', '"retencion" IS NOT NULL', '"tasaRetencion" IS NOT NULL', '"decretadoId" IS NOT NULL']) {
      expect(guardia, condicion).toContain(condicion);
      expect(sql, condicion).toContain(condicion);
    }
  });

  it("dice cómo correrlo en el Mac y en el VPS y qué hacer si algo no da 0", () => {
    expect(crudo).toMatch(/psql .*-f scripts\/contar-datos-oficiales\.sql/);
    expect(crudo).toMatch(/inv-008-db psql .*-U inv_dueno -d inversiones/);
    expect(crudo).toMatch(/CEO/);
  });
});
