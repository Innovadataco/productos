// docker/migrador/privilegios.sql: inv_app solo lee, más las escrituras exactas del login (contrato del
// frente login), por COLUMNA: UPDATE de "claveHash", "sesionVersion" y "bloqueadoHasta" en usuario,
// UPDATE de "usadoEn" en token_acceso e INSERT en intento_ingreso. Nunca DELETE, TRUNCATE, REFERENCES,
// TRIGGER ni DDL. inv_dueno es el dueño (crear-acceso-inicial.ts, en el migrador).
//
// Mientras la migración del login no esté en main, esas escrituras van dentro de UN solo IF atado a la
// tabla intento_ingreso (la crea esa migración). Al hacer rebase sobre el login se quita el IF: si faltan
// las tablas o las columnas, el GRANT falla y el despliegue se detiene (falla cerrada).
import { describe, expect, it } from "vitest";
import { leer008 } from "./falsos";

const sql = leer008("docker/migrador/privilegios.sql").replace(/--.*$/gm, "");
const grants = [...sql.matchAll(/GRANT\s+([A-Z]+(?:\s*\([^)]*\))?(?:\s*,\s*[A-Z]+(?:\s*\([^)]*\))?)*)\s+ON\s+(?:TABLE|SEQUENCE)\s+public\.(%I|[a-z_]+)\s+TO\s+inv_app/g)].map(
  (m) => `${m[1]!.replace(/\s+/g, " ").trim()} ${m[2]}`,
);

describe("privilegios de inv_app", () => {
  it("lectura en cada tabla, uso de secuencias y solo las escrituras del login, por columna", () => {
    expect(grants.sort()).toEqual(
      [
        "SELECT %I",
        "USAGE %I",
        'UPDATE ("claveHash", "sesionVersion", "bloqueadoHasta") usuario',
        'UPDATE ("usadoEn") token_acceso',
        "INSERT intento_ingreso",
      ].sort(),
    );
  });

  it("las escrituras del login van en un solo bloque, atado a la migración del login (se quita en el rebase)", () => {
    expect(sql.match(/IF to_regclass/g)).toHaveLength(1);
    expect(sql).toMatch(/IF to_regclass\('public\.intento_ingreso'\) IS NOT NULL THEN\s+GRANT UPDATE \("claveHash"/);
  });

  it("nunca DELETE, TRUNCATE, REFERENCES, TRIGGER, ALL ni DDL, y nunca UPDATE de tabla completa", () => {
    expect(sql).not.toMatch(/GRANT[^;]*(DELETE|TRUNCATE|REFERENCES|TRIGGER|ALL|CREATE)/);
    expect(sql).not.toMatch(/GRANT\s+UPDATE\s+ON/);
  });

  it("parte de cero en cada corrida y deja _prisma_migrations sin acceso", () => {
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.%I FROM inv_app/);
    expect(sql).toMatch(/IF t\.relname <> '_prisma_migrations' THEN/);
  });
});
