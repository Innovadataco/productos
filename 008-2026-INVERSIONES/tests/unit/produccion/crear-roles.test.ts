// crear-roles-prod.sh: crea inv_dueno e inv_app leyendo sus claves del archivo de producción y se las
// pasa a psql SOLO por la entrada estándar (nunca por argumentos, que se ven en `ps`).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, entorno, envProduccionFicticio, leer008, ruta008 } from "./falsos";

// Cada prueba corre scripts de bash con varios procesos: con la suite en paralelo puede pasar de 5 s.
vi.setConfig({ testTimeout: 60_000 });

const SCRIPT = ruta008("scripts/crear-roles-prod.sh");
const CLAVE_DUENO = "b".repeat(64);
const CLAVE_APP = "c".repeat(64);

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
