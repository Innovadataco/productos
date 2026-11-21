// docker/migrador/privilegios.sql: inv_app solo lee, más las escrituras exactas del login (contrato del
// frente login), por COLUMNA: UPDATE de "claveHash", "sesionVersion" y "bloqueadoHasta" en usuario,
// UPDATE de "usadoEn" en token_acceso e INSERT en intento_ingreso. Nunca DELETE, TRUNCATE, REFERENCES,
// TRIGGER ni DDL. inv_dueno es el dueño (crear-acceso-inicial.ts, en el migrador).
//
// Sin condiciones: si faltan las tablas o las columnas del login (migración 20261121050319_login), el
// GRANT falla y el despliegue se detiene (falla cerrada).
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

  it("las escrituras del login van sin condición (falla cerrada si faltan tablas o columnas)", () => {
    expect(sql).not.toMatch(/to_regclass/);
  });

  it("las columnas existen en la migración del login", () => {
    const login = leer008("prisma/migrations/20261121050319_login/migration.sql");
    for (const columna of ['"claveHash"', '"sesionVersion"', '"bloqueadoHasta"', '"usadoEn"']) expect(login).toContain(columna);
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

describe("privilegios del TOTP: bloque PREPARADO y comentado (lo activa el frente TOTP con su migración)", () => {
  const crudo = leer008("docker/migrador/privilegios.sql");

  it("trae las tres líneas preparadas, comentadas", () => {
    for (const linea of [
      "--   GRANT INSERT ON TABLE public.codigo_recuperacion TO inv_app;",
      '--   GRANT UPDATE ("usadoEn", "anuladoEn") ON TABLE public.codigo_recuperacion TO inv_app;',
      '--   GRANT UPDATE ("totpSecreto", "totpActivadoEn", "totpUltimoPaso", "presesionHash") ON TABLE public.usuario TO inv_app;',
    ]) {
      expect(crudo).toContain(linea);
    }
  });

  it("no hay ningún GRANT activo sobre codigo_recuperacion ni sobre columnas TOTP (fallaría cerrado sin la migración)", () => {
    expect(sql).not.toMatch(/codigo_recuperacion|totpSecreto|presesionHash/);
  });
});
