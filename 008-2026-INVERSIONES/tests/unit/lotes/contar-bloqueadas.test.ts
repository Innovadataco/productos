// scripts/contar-bloqueadas.sql: lo corre el dueño contra su base antes de la carga, para saber si tiene
// bloqueadas inválidas ya guardadas. Solo lectura (transacción READ ONLY que se deshace) y solo conteos por
// código: nunca ids, cantidades ni costos. Que cuente bien contra PostgreSQL lo prueba tests/integracion/lotes.test.ts.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const crudo = readFileSync(fileURLToPath(new URL("../../../scripts/contar-bloqueadas.sql", import.meta.url)), "utf8");
const sql = crudo.replace(/--.*$/gm, "");
const sentencias = sql.split(";").map((s) => s.trim()).filter(Boolean);
/** Cada fila de conteo: `SELECT <n>, '<CODIGO>', <expresión> FROM …`. */
const FILA = /SELECT\s+\d+(?:\s+AS\s+n)?\s*,\s*'([A-Z_]+)'(?:\s+AS\s+codigo)?\s*,\s*(.+?)\s+FROM\b/g;
const CODIGOS = [
  "BLOQUEADA_VENTA_AJENA", "BLOQUEADA_LOTE_AJENO", "BLOQUEADA_LOTE_POSTERIOR", "BLOQUEADA_EXCEDE_VENTA",
  "BLOQUEADA_EXCEDE_LOTE", "BLOQUEADA_EXCEDE_COSTO", "BLOQUEADA_COSTO_DESCUADRADO",
];

describe("contar-bloqueadas.sql", () => {
  it("corre en una transacción READ ONLY que se deshace, con una sola consulta en medio", () => {
    expect(sentencias[0]).toMatch(/^BEGIN\s+TRANSACTION\s+READ\s+ONLY$/i);
    expect(sentencias.at(-1)).toMatch(/^ROLLBACK$/i);
    expect(sentencias).toHaveLength(3);
    expect(sentencias[1]).toMatch(/^WITH\b/i);
  });

  it("no escribe ni cambia nada (ni datos ni esquema)", () => {
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|VALIDATE|COPY|COMMIT|SET)\b/i);
  });

  it("devuelve solo código y conteo: la última SELECT no saca columnas de las filas", () => {
    const final = sentencias[1]!.slice(sentencias[1]!.search(/\)\s*SELECT\s+r\.codigo/i));
    expect(final).toMatch(/SELECT\s+r\.codigo\s*,\s*r\.filas\s+FROM/i);
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    const filas = [...sentencias[1]!.matchAll(FILA)];
    expect(filas).toHaveLength(CODIGOS.length + 1);
    for (const m of filas) expect(m[2], m[1]).toMatch(/^count\(\*\)(?:\s+AS\s+filas)?(?:\s+FILTER\s+\(WHERE\b.*\))?$/);
  });

  it("cubre exactamente los códigos de la regla de coherencia, más el total de bloqueadas", () => {
    const enScript = [...sentencias[1]!.matchAll(FILA)].map((m) => m[1]!);
    expect([...enScript].sort()).toEqual(["BLOQUEADAS", ...CODIGOS].sort());
  });

  it("explica en su cabecera cómo correrlo y que el FIFO (INCOMPLETA, COSTO_NEGATIVO) se ve con el ensayo", () => {
    expect(crudo).toContain("psql");
    expect(crudo).toContain("npm run lotes:construir -- --ensayo");
  });
});
