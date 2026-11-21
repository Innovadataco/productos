// docker/migrador/privilegios.sql: inv_app solo lee, más las escrituras exactas del login y del TOTP
// (contratos de esos frentes), por COLUMNA: UPDATE de "claveHash", "sesionVersion" y "bloqueadoHasta" en
// usuario, UPDATE de "usadoEn" en token_acceso, INSERT en intento_ingreso y, del TOTP, UPDATE de
// "totpSecreto", "totpActivadoEn", "totpUltimoPaso" y "presesionHash" en usuario, más INSERT y UPDATE de
// "usadoEn" y "anuladoEn" en codigo_recuperacion. Nunca DELETE, TRUNCATE, REFERENCES, TRIGGER ni DDL.
// inv_dueno es el dueño (crear-acceso-inicial.ts y --reiniciar-totp, en el migrador).
//
// Sin condiciones: si faltan las tablas o las columnas del login (20261121050319_login) o del TOTP
// (20261121060000_totp), el GRANT falla y el despliegue se detiene (falla cerrada).
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { leer008, ruta008 } from "./falsos";

const sql = leer008("docker/migrador/privilegios.sql").replace(/--.*$/gm, "");
const grants = [...sql.matchAll(/GRANT\s+([A-Z]+(?:\s*\([^)]*\))?(?:\s*,\s*[A-Z]+(?:\s*\([^)]*\))?)*)\s+ON\s+(?:TABLE|SEQUENCE)\s+public\.(%I|[a-z_]+)\s+TO\s+inv_app/g)].map(
  (m) => `${m[1]!.replace(/\s+/g, " ").trim()} ${m[2]}`,
);

describe("privilegios de inv_app", () => {
  it("lectura en cada tabla, uso de secuencias y solo las escrituras del login y del TOTP, por columna", () => {
    expect(grants.sort()).toEqual(
      [
        "SELECT %I",
        "USAGE %I",
        'UPDATE ("claveHash", "sesionVersion", "bloqueadoHasta") usuario',
        'UPDATE ("usadoEn") token_acceso',
        "INSERT intento_ingreso",
        "INSERT codigo_recuperacion",
        'UPDATE ("usadoEn", "anuladoEn") codigo_recuperacion',
        'UPDATE ("totpSecreto", "totpActivadoEn", "totpUltimoPaso", "presesionHash") usuario',
      ].sort(),
    );
  });

  it("las escrituras del login y del TOTP van sin condición (falla cerrada si faltan tablas o columnas)", () => {
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

  it("cada migración que citan sus comentarios existe con ese nombre (antes citaba un login que no existía)", () => {
    const existentes = new Set(readdirSync(ruta008("prisma/migrations"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name));
    const citadas = [...leer008("docker/migrador/privilegios.sql").matchAll(/\b\d{14}_[a-z0-9_]+/g)].map((m) => m[0]);
    expect(citadas.length).toBeGreaterThan(0);
    for (const citada of citadas) expect(existentes.has(citada), citada).toBe(true);
  });

  it("parte de cero en cada corrida y deja _prisma_migrations sin acceso", () => {
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.%I FROM inv_app/);
    expect(sql).toMatch(/IF t\.relname <> '_prisma_migrations' THEN/);
  });
});

describe("privilegios del TOTP: activos desde su migración", () => {
  it("las columnas y la tabla existen en la migración del TOTP", () => {
    const totp = leer008("prisma/migrations/20261121060000_totp/migration.sql");
    expect(totp).toContain('CREATE TABLE "codigo_recuperacion"');
    for (const columna of ['"totpSecreto"', '"totpActivadoEn"', '"totpUltimoPaso"', '"presesionHash"', '"usadoEn"', '"anuladoEn"']) expect(totp).toContain(columna);
  });

  it("no hay ningún GRANT comentado: lo preparado quedó activo", () => {
    const crudo = leer008("docker/migrador/privilegios.sql");
    expect(crudo).not.toMatch(/^\s*--\s*GRANT/m);
  });

  it("los códigos de recuperación no se borran: ni DELETE ni UPDATE de su hash", () => {
    expect(sql).not.toMatch(/GRANT[^;]*DELETE[^;]*codigo_recuperacion/);
    expect(sql).not.toMatch(/GRANT UPDATE \([^)]*"codigoHash"/);
  });
});
