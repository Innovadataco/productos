// crear-roles-prod.sh · inv_alertas (el servicio de las alertas, contenedor propio). Igual que inv_precios e inv_ia: existe
// SIEMPRE desde la primera corrida (así los GRANT de inv_alertas que traiga un respaldo encuentran el rol en la restauración);
// sin INV_ALERTAS_DATABASE_URL en el archivo de producción queda NOLOGIN y sin clave (también si antes tenía LOGIN); con ella,
// recibe LOGIN y su clave por stdin; presente pero mal formada o repetida, aborta sin tocar Docker. Sus permisos de tablas
// los da privilegios.sql (tests/unit/produccion/privilegios-alertas.test.ts). El script lo corre Jelk en el VPS: aquí solo con
// los falsos de Docker (nunca contra una base).
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, funcion, ruta008 } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const SCRIPT = ruta008("scripts/crear-roles-prod.sh");
const CLAVE_DUENO = "b".repeat(64);
const CLAVE_APP = "c".repeat(64);
const CLAVE_PRECIOS = "f".repeat(64);
const CLAVE_ALERTAS = "5d".repeat(32);
const CLAVE_IA = "9a".repeat(32);
const URL_IA = `postgresql://inv_ia:${CLAVE_IA}@inv-008-db:5432/inversiones?connection_limit=1`;
const URL_PRECIOS = `postgresql://inv_precios:${CLAVE_PRECIOS}@inv-008-db:5432/inversiones?connection_limit=2`;
const URL_ALERTAS = `postgresql://inv_alertas:${CLAVE_ALERTAS}@inv-008-db:5432/inversiones?connection_limit=1`;
const SIN_LOGIN = "ALTER ROLE inv_alertas WITH NOLOGIN PASSWORD NULL;";
const CON_LOGIN = "ALTER ROLE inv_alertas WITH LOGIN PASSWORD :'clave_alertas';";

function preparar(cambios: Record<string, string> = {}) {
  const base = carpetaTemporal("roles-alertas");
  envProduccionFicticio(base, cambios);
  const falsos = crearFalsos(base);
  const stdin = path.join(base, "stdin-psql.txt");
  const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_STDIN: stdin });
  return { base, falsos, stdin, env };
}
const sinDocker = (falsos: ReturnType<typeof preparar>["falsos"]) => falsos.llamadas().filter((l) => l[0] === "docker");

function sqlDe(nombre: "sql_rol_alertas" | "sql_rol_ia" | "sql_rol_precios" | "sql_alertas_sin_login"): string {
  const r = funcion(SCRIPT, nombre, { PATH: process.env.PATH });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout;
}

/** Las posiciones de los trozos en el SQL, en el orden dado: todas presentes y crecientes. */
function enOrden(sql: string, trozos: readonly string[]): void {
  const posiciones = trozos.map((trozo) => sql.indexOf(trozo));
  expect(posiciones.every((p) => p >= 0), JSON.stringify(posiciones)).toBe(true);
  expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
}

describe("crear-roles-prod.sh · inv_alertas (existe siempre; LOGIN solo con su secreto)", () => {
  it("sin INV_ALERTAS_DATABASE_URL crea inv_alertas NOLOGIN y sin clave, después de inv_precios y de inv_ia, y lo avisa", async () => {
    const { falsos, stdin, env } = preparar();
    const r = await correr(SCRIPT, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toMatch(/sin INV_ALERTAS_DATABASE_URL[^\n]*inv_alertas existe sin LOGIN y sin clave/);
    const sql = readFileSync(stdin, "utf8");
    enOrden(sql, ["ALTER ROLE inv_app PASSWORD :'clave_app';", sqlDe("sql_rol_precios"), sqlDe("sql_rol_ia"), sqlDe("sql_rol_alertas"), SIN_LOGIN]);
    expect(sql).not.toContain("clave_alertas");
    expect(sql).not.toContain(CON_LOGIN);
    expect(sinDocker(falsos)).toHaveLength(2);
  });

  it("con la URL le da LOGIN y la clave en una sola sentencia, por stdin y con el registro de errores apagado", async () => {
    const { falsos, stdin, env } = preparar({ INV_PRECIOS_DATABASE_URL: URL_PRECIOS, INV_IA_DATABASE_URL: URL_IA, INV_ALERTAS_DATABASE_URL: URL_ALERTAS });
    const r = await correr(SCRIPT, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).not.toMatch(/inv_alertas existe sin LOGIN/);
    const sql = readFileSync(stdin, "utf8");
    enOrden(sql, ["ALTER ROLE inv_precios WITH LOGIN PASSWORD :'clave_precios';", sqlDe("sql_rol_ia"), sqlDe("sql_rol_alertas"), `\\set clave_alertas '${CLAVE_ALERTAS}'`, CON_LOGIN, "\\unset clave_alertas"]);
    expect(sql).not.toContain(SIN_LOGIN);
    expect(sql.indexOf("SET log_min_error_statement = 'panic';")).toBeLessThan(sql.indexOf("\\set clave_alertas"));
    expect(sinDocker(falsos)).toHaveLength(2);
  });

  it("con o sin la URL, el «creando» y el «roles listos» nombran a inv_alertas", async () => {
    const casos: ReadonlyArray<Record<string, string>> = [{}, { INV_ALERTAS_DATABASE_URL: URL_ALERTAS }];
    for (const cambios of casos) {
      const { stdin, env } = preparar(cambios);
      const r = await correr(SCRIPT, [], env);
      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr).toMatch(/creando o actualizando inv_alertas/);
      const listos = readFileSync(stdin, "utf8").split("\n").find((l) => l.startsWith("SELECT 'roles listos: '")) ?? "";
      expect(listos).toContain("'inv_alertas'");
      expect(listos).toContain("'inv_precios'");
      expect(listos).toContain("'inv_ia'");
    }
  });

  it("la clave de inv_alertas nunca aparece en los argumentos de ningún comando ni en la salida", async () => {
    const { falsos, env } = preparar({ INV_ALERTAS_DATABASE_URL: URL_ALERTAS });
    const r = await correr(SCRIPT, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(falsos.registro, "utf8") + r.stdout + r.stderr).not.toContain(CLAVE_ALERTAS);
  });

  const malas: Array<[string, Record<string, string>]> = [
    ["vacía", { INV_ALERTAS_DATABASE_URL: "" }],
    ["con el marcador <clave> sin llenar", { INV_ALERTAS_DATABASE_URL: "postgresql://inv_alertas:<clave>@inv-008-db:5432/inversiones?connection_limit=1" }],
    ["con una clave corta", { INV_ALERTAS_DATABASE_URL: "postgresql://inv_alertas:corta@inv-008-db:5432/inversiones?connection_limit=1" }],
    ["con otro usuario", { INV_ALERTAS_DATABASE_URL: `postgresql://inv_app:${CLAVE_ALERTAS}@inv-008-db:5432/inversiones?connection_limit=1` }],
    ["con otro host", { INV_ALERTAS_DATABASE_URL: `postgresql://inv_alertas:${CLAVE_ALERTAS}@pi-db:5432/inversiones?connection_limit=1` }],
    ["con otra base", { INV_ALERTAS_DATABASE_URL: `postgresql://inv_alertas:${CLAVE_ALERTAS}@inv-008-db:5432/proteccion_infantil?connection_limit=1` }],
    ["con la clave de inv_dueno", { INV_ALERTAS_DATABASE_URL: `postgresql://inv_alertas:${CLAVE_DUENO}@inv-008-db:5432/inversiones?connection_limit=1` }],
    ["con la clave de inv_app", { INV_ALERTAS_DATABASE_URL: `postgresql://inv_alertas:${CLAVE_APP}@inv-008-db:5432/inversiones?connection_limit=1` }],
    ["con la clave de inv_precios", { INV_PRECIOS_DATABASE_URL: URL_PRECIOS, INV_ALERTAS_DATABASE_URL: `postgresql://inv_alertas:${CLAVE_PRECIOS}@inv-008-db:5432/inversiones?connection_limit=1` }],
    ["con la clave de inv_ia", { INV_IA_DATABASE_URL: URL_IA, INV_ALERTAS_DATABASE_URL: `postgresql://inv_alertas:${CLAVE_IA}@inv-008-db:5432/inversiones?connection_limit=1` }],
  ];
  for (const [nombre, cambios] of malas) {
    it(`con INV_ALERTAS_DATABASE_URL ${nombre}: aborta sin tocar Docker y dice que es por inv_alertas`, async () => {
      const { falsos, env } = preparar(cambios);
      const r = await correr(SCRIPT, [], env);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/inv_alertas/);
      expect(r.stderr).not.toContain(CLAVE_ALERTAS);
      expect(sinDocker(falsos)).toEqual([]);
    });
  }
});

describe("sql_rol_alertas (SQL puro, sin claves)", () => {
  let sql = "";
  let sinComentarios = "";
  beforeAll(() => {
    sql = sqlDe("sql_rol_alertas");
    sinComentarios = sql.replace(/--.*$/gm, "");
  });

  it("sale tal cual, sin expandir nada (heredoc entre comillas): trae el DO $$ literal", () => {
    expect(sql).toContain("DO $$");
    expect(sql).not.toMatch(/\$\{|\$\(/);
  });

  it("crea inv_alertas solo si no existe, NOLOGIN y sin clave; nunca le da LOGIN (eso va solo con su secreto)", () => {
    expect(sinComentarios).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'inv_alertas'\) THEN\s+CREATE ROLE inv_alertas NOLOGIN;/);
    expect(sinComentarios).not.toMatch(/\bLOGIN\b(?<!NOLOGIN)/);
    expect(sinComentarios).not.toMatch(/PASSWORD/);
  });

  it("sin superusuario, sin crear bases ni roles, sin replicación, sin BYPASSRLS, NOINHERIT y 2 conexiones", () => {
    expect(sinComentarios).toMatch(/ALTER ROLE inv_alertas WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 2;/);
  });

  it("el registro de errores de su sesión es terse: el DETAIL de una fila rechazada (ids y precios) no llega al log de PostgreSQL", () => {
    expect(sinComentarios).toMatch(/^ALTER ROLE inv_alertas SET log_error_verbosity = 'terse';$/m);
  });

  it("topes por sesión: statement_timeout 60s e idle_in_transaction_session_timeout 30s", () => {
    expect(sinComentarios).toMatch(/^ALTER ROLE inv_alertas SET statement_timeout = '60s';$/m);
    expect(sinComentarios).toMatch(/^ALTER ROLE inv_alertas SET idle_in_transaction_session_timeout = '30s';$/m);
  });

  it("solo se conecta a la base y usa el esquema: los privilegios de tablas los da privilegios.sql", () => {
    expect(sinComentarios).toMatch(/EXECUTE format\('GRANT CONNECT ON DATABASE %I TO inv_alertas', current_database\(\)\);/);
    expect(sinComentarios).toMatch(/GRANT USAGE ON SCHEMA public TO inv_alertas;/);
    expect(sinComentarios).not.toMatch(/GRANT[^;]*ON\s+(TABLE|ALL TABLES|SEQUENCE)/);
    expect(sinComentarios).not.toMatch(/DEFAULT PRIVILEGES/);
  });

  it("sql_alertas_sin_login (sin el secreto) le quita el LOGIN y la clave, también si ya los tenía", () => {
    expect(sqlDe("sql_alertas_sin_login")).toBe(`${SIN_LOGIN}\n`);
  });
});
