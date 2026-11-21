// crear-roles-prod.sh: crea inv_dueno e inv_app leyendo sus claves del archivo de producción y se las
// pasa a psql SOLO por la entrada estándar (nunca por argumentos, que se ven en `ps`). inv_precios (el servicio
// de precios, PR 3) es opcional: sin INV_PRECIOS_DATABASE_URL en el archivo se omite y se avisa; con ella, se crea
// y se le fija la clave igual que a los otros dos; presente pero mal formada, aborta sin tocar Docker.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, funcion, leer008, ruta008 } from "./falsos";

// Cada prueba corre scripts de bash con varios procesos: con la suite en paralelo puede pasar de 5 s.
vi.setConfig({ testTimeout: 60_000 });

const SCRIPT = ruta008("scripts/crear-roles-prod.sh");
const CLAVE_DUENO = "b".repeat(64);
const CLAVE_APP = "c".repeat(64);
const CLAVE_PRECIOS = "f".repeat(64);
// El formato que el CEO le dio a Jelk (ESTADO de la gestión): sin schema y con connection_limit=2.
const URL_PRECIOS = `postgresql://inv_precios:${CLAVE_PRECIOS}@inv-008-db:5432/inversiones?connection_limit=2`;

function preparar(cambios: Record<string, string> = {}) {
  const base = carpetaTemporal("roles");
  envProduccionFicticio(base, cambios);
  const falsos = crearFalsos(base);
  const stdin = path.join(base, "stdin-psql.txt");
  const env = entorno(falsos, { INV_PROYECTO: "inv-008-prueba", INV_BASE: base, FALSO_STDIN: stdin });
  return { base, falsos, stdin, env };
}

describe("crear-roles-prod.sh", () => {
  it("levanta solo la base del proyecto y le pasa el SQL y las claves por stdin", async () => {
    const { falsos, stdin, env } = preparar();
    const r = await correr(SCRIPT, [], env);
    expect(r.status, r.stderr).toBe(0);
    const llamadas = falsos.llamadas().filter((l) => l[0] === "docker");
    expect(llamadas.map((l) => l.slice(1, 4))).toEqual([
      ["compose", "-p", "inv-008-prueba"],
      ["compose", "-p", "inv-008-prueba"],
    ]);
    expect(llamadas[0]).toEqual(expect.arrayContaining(["up", "-d", "--wait", "inv-008-db"]));
    expect(llamadas[1]).toEqual(expect.arrayContaining(["exec", "-T", "inv-008-db", "psql", "-U", "postgres", "-d", "inversiones"]));
    const sql = readFileSync(stdin, "utf8");
    expect(sql).toContain(leer008("scripts/crear-roles-prod.sql"));
    expect(sql).toContain(`\\set clave_dueno '${CLAVE_DUENO}'`);
    expect(sql).toContain("ALTER ROLE inv_dueno PASSWORD :'clave_dueno';");
    expect(sql).toContain("ALTER ROLE inv_app PASSWORD :'clave_app';");
  });

  it("las claves nunca aparecen en los argumentos de ningún comando ni en la salida", async () => {
    const { falsos, env } = preparar();
    const r = await correr(SCRIPT, [], env);
    const todo = readFileSync(falsos.registro, "utf8") + r.stdout + r.stderr;
    expect(todo).not.toContain(CLAVE_DUENO);
    expect(todo).not.toContain(CLAVE_APP);
  });

  it("silencia el registro de errores de la base antes de fijar las claves", async () => {
    const { stdin, env } = preparar();
    await correr(SCRIPT, [], env);
    const sql = readFileSync(stdin, "utf8");
    const silencio = sql.indexOf("SET log_min_error_statement = 'panic';");
    expect(silencio).toBeGreaterThanOrEqual(0);
    expect(sql.indexOf("\\set VERBOSITY terse")).toBeLessThan(sql.indexOf("\\set clave_dueno"));
    expect(silencio).toBeLessThan(sql.indexOf("\\set clave_dueno"));
  });

  const malas: Array<[string, Record<string, string>]> = [
    ["clave corta", { INV_APP_DATABASE_URL: "postgresql://inv_app:corta@inv-008-db:5432/inversiones?schema=public" }],
    ["clave con comilla", { INV_APP_DATABASE_URL: `postgresql://inv_app:${"c".repeat(40)}'x@inv-008-db:5432/inversiones` }],
    ["usuario cambiado", { INV_APP_DATABASE_URL: `postgresql://inv_dueno:${"c".repeat(64)}@inv-008-db:5432/inversiones` }],
    ["otro host", { INV_DUENO_DATABASE_URL: `postgresql://inv_dueno:${"b".repeat(64)}@pi-db:5432/inversiones` }],
    ["otra base", { INV_DUENO_DATABASE_URL: `postgresql://inv_dueno:${"b".repeat(64)}@inv-008-db:5432/proteccion_infantil` }],
    ["misma clave en los dos roles", { INV_APP_DATABASE_URL: `postgresql://inv_app:${"b".repeat(64)}@inv-008-db:5432/inversiones` }],
  ];
  for (const [nombre, cambios] of malas) {
    it(`aborta sin tocar Docker con ${nombre}`, async () => {
      const { falsos, env } = preparar(cambios);
      const r = await correr(SCRIPT, [], env);
      expect(r.status).not.toBe(0);
      expect(falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
    });
  }

  it("aborta si falta una URL en el archivo de producción", async () => {
    const { base, falsos, env } = preparar();
    envProduccionFicticio(base, { INV_DUENO_DATABASE_URL: "" });
    expect((await correr(SCRIPT, [], env)).status).not.toBe(0);
    expect(falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
  });

  it("con la marca de pausa se niega, sin tocar Docker", async () => {
    const { base, falsos, env } = preparar();
    mkdirSync(path.join(base, "estado"), { recursive: true });
    writeFileSync(path.join(base, "estado", "pausado"), "pausa\n");
    const r = await correr(SCRIPT, [], env);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/pausa/);
    expect(falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
  });

  it("toma el candado propio y el común sin esperar; con el común ocupado dice «PI desplegando»", async () => {
    const { falsos, env } = preparar();
    expect((await correr(SCRIPT, [], env)).status).toBe(0);
    expect(falsos.llamadas().filter((l) => l[0] === "flock")).toHaveLength(2);
    for (const fd of ["8", "9"]) {
      const p = preparar({});
      const r = await correr(SCRIPT, [], { ...p.env, FALSO_FLOCK_OCUPADO: fd });
      expect(r.status).not.toBe(0);
      if (fd === "9") expect(r.stderr).toMatch(/PI desplegando/);
      expect(p.falsos.llamadas().filter((l) => l[0] === "docker")).toEqual([]);
    }
  });

  it("nunca corre contra el proyecto de desarrollo inv-008", async () => {
    const { falsos, env } = preparar();
    const r = await correr(SCRIPT, [], { ...env, INV_PROYECTO: "inv-008" });
    expect(r.status).not.toBe(0);
    expect(falsos.llamadas()).toEqual([]);
  });
});

describe("crear-roles-prod.sql (SQL puro, sin claves)", () => {
  const sql = leer008("scripts/crear-roles-prod.sql");
  const sinComentarios = sql.replace(/--.*$/gm, "");

  it("no trae claves ni metacomandos de psql", async () => {
    expect(sinComentarios).not.toMatch(/PASSWORD/i);
    expect(sinComentarios).not.toMatch(/^\s*\\/m);
  });

  it("inv_dueno e inv_app sin superusuario, sin crear bases ni roles, sin replicación ni BYPASSRLS", async () => {
    for (const rol of ["inv_dueno", "inv_app"]) {
      expect(sinComentarios).toMatch(new RegExp(`ALTER ROLE ${rol} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`));
    }
    expect(sinComentarios).toMatch(/ALTER ROLE inv_app WITH [^;]*NOINHERIT/);
  });

  it("inv_dueno es dueño de la base y del esquema; PUBLIC no conecta ni crea", async () => {
    expect(sinComentarios).toMatch(/ALTER DATABASE %I OWNER TO inv_dueno/);
    expect(sinComentarios).toMatch(/REVOKE ALL ON DATABASE %I FROM PUBLIC/);
    expect(sinComentarios).toMatch(/ALTER SCHEMA public OWNER TO inv_dueno/);
    expect(sinComentarios).toMatch(/REVOKE ALL ON SCHEMA public FROM PUBLIC/);
  });

  it("las funciones nuevas de inv_dueno no son ejecutables por PUBLIC", async () => {
    expect(sinComentarios).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE inv_dueno REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;/);
  });

  it("por defecto inv_app solo LEE las tablas nuevas: nunca TRUNCATE ni DDL", async () => {
    expect(sinComentarios).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE inv_dueno IN SCHEMA public GRANT SELECT ON TABLES TO inv_app;/);
    expect(sinComentarios).not.toMatch(/TRUNCATE|GRANT ALL|GRANT CREATE|REFERENCES|TRIGGER ON/i);
  });
});

/** El SQL del rol inv_precios tal como lo emite el script (función sql_rol_precios), con un entorno sin INV_*. */
function sqlRolPrecios(): string {
  const r = funcion(SCRIPT, "sql_rol_precios", { PATH: process.env.PATH });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout;
}

describe("crear-roles-prod.sh · inv_precios (opcional hasta el servicio de precios)", () => {
  const sinDocker = (falsos: ReturnType<typeof preparar>["falsos"]) => falsos.llamadas().filter((l) => l[0] === "docker");

  it("sin INV_PRECIOS_DATABASE_URL no falla: omite inv_precios, lo avisa y no le crea rol ni clave", async () => {
    const { falsos, stdin, env } = preparar();
    const r = await correr(SCRIPT, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toMatch(/INV_PRECIOS_DATABASE_URL/);
    expect(r.stderr).toMatch(/se omite inv_precios/);
    const sql = readFileSync(stdin, "utf8");
    expect(sql).not.toContain("CREATE ROLE inv_precios");
    expect(sql).not.toContain("clave_precios");
    expect(sql).not.toMatch(/ALTER ROLE inv_precios/);
    expect(sql).toContain("ALTER ROLE inv_app PASSWORD :'clave_app';");
    expect(sinDocker(falsos)).toHaveLength(2);
  });

  it("la línea comentada de la plantilla cuenta como ausente: omite y avisa", async () => {
    const { base, stdin, env } = preparar();
    appendFileSync(path.join(base, ".env.inversiones.production"), "# INV_PRECIOS_DATABASE_URL=postgresql://inv_precios:<clave>@inv-008-db:5432/inversiones?connection_limit=2\n");
    const r = await correr(SCRIPT, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toMatch(/se omite inv_precios/);
    expect(readFileSync(stdin, "utf8")).not.toContain("clave_precios");
  });

  it("con la URL (formato del ESTADO) crea el rol y le fija la clave por stdin, después de los otros dos", async () => {
    const { falsos, stdin, env } = preparar({ INV_PRECIOS_DATABASE_URL: URL_PRECIOS });
    const r = await correr(SCRIPT, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).not.toMatch(/se omite inv_precios/);
    const sql = readFileSync(stdin, "utf8");
    const posiciones = [
      "ALTER ROLE inv_app PASSWORD :'clave_app';",
      sqlRolPrecios(),
      `\\set clave_precios '${CLAVE_PRECIOS}'`,
      "ALTER ROLE inv_precios PASSWORD :'clave_precios';",
      "\\unset clave_precios",
    ].map((trozo) => sql.indexOf(trozo));
    expect(posiciones.every((p) => p >= 0), JSON.stringify(posiciones)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
    expect(sql.indexOf("SET log_min_error_statement = 'panic';")).toBeLessThan(sql.indexOf("\\set clave_precios"));
    expect(sql).toMatch(/SELECT 'roles listos: '[^\n]*'inv_precios'/);
    expect(sinDocker(falsos)).toHaveLength(2);
  });

  it("la clave de inv_precios nunca aparece en los argumentos de ningún comando ni en la salida", async () => {
    const { falsos, env } = preparar({ INV_PRECIOS_DATABASE_URL: URL_PRECIOS });
    const r = await correr(SCRIPT, [], env);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(falsos.registro, "utf8") + r.stdout + r.stderr).not.toContain(CLAVE_PRECIOS);
  });

  const malasPrecios: Array<[string, string]> = [
    ["vacía", ""],
    ["marcador <clave> sin llenar", "postgresql://inv_precios:<clave>@inv-008-db:5432/inversiones?connection_limit=2"],
    ["clave corta", "postgresql://inv_precios:corta@inv-008-db:5432/inversiones?connection_limit=2"],
    ["clave con comilla", `postgresql://inv_precios:${"f".repeat(40)}'x@inv-008-db:5432/inversiones?connection_limit=2`],
    ["usuario cambiado", `postgresql://inv_app:${CLAVE_PRECIOS}@inv-008-db:5432/inversiones?connection_limit=2`],
    ["otro host", `postgresql://inv_precios:${CLAVE_PRECIOS}@pi-db:5432/inversiones?connection_limit=2`],
    ["otra base", `postgresql://inv_precios:${CLAVE_PRECIOS}@inv-008-db:5432/proteccion_infantil?connection_limit=2`],
    ["la misma clave de inv_dueno", `postgresql://inv_precios:${CLAVE_DUENO}@inv-008-db:5432/inversiones?connection_limit=2`],
    ["la misma clave de inv_app", `postgresql://inv_precios:${CLAVE_APP}@inv-008-db:5432/inversiones?connection_limit=2`],
  ];
  for (const [nombre, url] of malasPrecios) {
    it(`con INV_PRECIOS_DATABASE_URL ${nombre}: aborta sin tocar Docker y dice que es por inv_precios`, async () => {
      const { falsos, env } = preparar({ INV_PRECIOS_DATABASE_URL: url });
      const r = await correr(SCRIPT, [], env);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/inv_precios/);
      expect(r.stderr).not.toContain(CLAVE_PRECIOS);
      expect(sinDocker(falsos)).toEqual([]);
    });
  }
});

describe("sql_rol_precios (SQL puro, sin claves)", () => {
  let sql = "";
  let sinComentarios = "";
  beforeAll(() => {
    sql = sqlRolPrecios();
    sinComentarios = sql.replace(/--.*$/gm, "");
  });

  it("sale tal cual, sin expandir nada (heredoc entre comillas): trae el DO $$ literal", () => {
    expect(sql).toContain("DO $$");
    expect(sql).not.toMatch(/\$\{|\$\(/);
  });

  it("crea inv_precios solo si no existe, con LOGIN y sin clave", () => {
    expect(sinComentarios).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'inv_precios'\) THEN\s+CREATE ROLE inv_precios LOGIN;/);
    expect(sinComentarios).not.toMatch(/PASSWORD/i);
    expect(sinComentarios).not.toMatch(/^\s*\\/m);
  });

  // 4 conexiones: el pool de su URL (connection_limit=2) dos veces, p. ej. precios:actualizar y actualizar-fondo a la
  // vez (revisión de base, M2). Con inv_dueno (5) e inv_app (10) suman 19 de las 30 de la base.
  it("sin superusuario, sin crear bases ni roles, sin replicación, sin BYPASSRLS, NOINHERIT y 4 conexiones", () => {
    expect(sinComentarios).toMatch(/ALTER ROLE inv_precios WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 4;/);
  });

  it("solo se conecta a la base y usa el esquema: los privilegios de tablas los da privilegios.sql", () => {
    expect(sinComentarios).toMatch(/EXECUTE format\('GRANT CONNECT ON DATABASE %I TO inv_precios', current_database\(\)\);/);
    expect(sinComentarios).toMatch(/GRANT USAGE ON SCHEMA public TO inv_precios;/);
    expect(sinComentarios).not.toMatch(/ALTER DEFAULT PRIVILEGES/);
    expect(sinComentarios).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|TRUNCATE|ALL|CREATE|TEMP)/i);
    expect(sinComentarios).not.toMatch(/GRANT\s+inv_/);
  });
});
