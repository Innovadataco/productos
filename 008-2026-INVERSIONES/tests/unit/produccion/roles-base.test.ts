// Roles de producción contra una PostgreSQL 16 real: crear-roles-prod.sql + migraciones como inv_dueno +
// guardián del esquema + privilegios.sql, y luego inv_app intenta lo que nunca debe poder hacer.
//
// Corre SOLO en GitHub Actions (GITHUB_ACTIONS=true), contra la base efímera del job `app-008`
// (DATABASE_URL_TEST, superusuario, nombre terminado en _test). Nunca en el Mac: los roles son globales
// del clúster y el clúster local tiene la base de trabajo. Si los roles ya existen, se niega (no son suyos).
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ruta008 } from "./falsos";

const URL_BASE = process.env.DATABASE_URL_TEST ?? "";
const EN_CI = process.env.GITHUB_ACTIONS === "true";
const BASE_PRUEBA = "inv_roles_test";
const CLAVE_DUENO = "d".repeat(48);
const CLAVE_APP = "e".repeat(48);

const conBase = (usuario: string, clave: string | null, base: string) => {
  const u = new URL(URL_BASE);
  if (clave !== null) {
    u.username = usuario;
    u.password = clave;
  }
  u.pathname = `/${base}`;
  u.search = "?schema=public";
  return u.toString();
};
const superusuario = (base: string) => conBase("", null, base);

function prisma(args: string[], url: string) {
  const r = spawnSync(ruta008("node_modules/.bin/prisma"), args, { cwd: ruta008("."), env: { ...process.env, DATABASE_URL: url }, encoding: "utf8" });
  return r;
}
const ejecutarSql = (archivo: string, url: string) => prisma(["db", "execute", "--url", url, "--file", archivo], url);

describe.skipIf(!EN_CI)("roles de producción en PostgreSQL real (solo CI)", () => {
  let admin: PrismaClient;
  let app: PrismaClient;

  beforeAll(async () => {
    const nombre = decodeURIComponent(new URL(URL_BASE).pathname.slice(1));
    if (!nombre.endsWith("_test")) throw new Error("DATABASE_URL_TEST debe apuntar a una base *_test");
    admin = new PrismaClient({ datasources: { db: { url: URL_BASE } } });
    const existentes = await admin.$queryRawUnsafe<Array<{ n: bigint }>>("SELECT count(*) AS n FROM pg_roles WHERE rolname IN ('inv_dueno','inv_app')");
    if (Number(existentes[0]!.n) !== 0) throw new Error("los roles inv_dueno/inv_app ya existen en este clúster: no se tocan");
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${BASE_PRUEBA}`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${BASE_PRUEBA}`);

    const roles = ejecutarSql(ruta008("scripts/crear-roles-prod.sql"), superusuario(BASE_PRUEBA));
    if (roles.status !== 0) throw new Error(`crear-roles-prod.sql: ${roles.stderr}`);
    const enPrueba = new PrismaClient({ datasources: { db: { url: superusuario(BASE_PRUEBA) } } });
    await enPrueba.$executeRawUnsafe(`ALTER ROLE inv_dueno PASSWORD '${CLAVE_DUENO}'`);
    await enPrueba.$executeRawUnsafe(`ALTER ROLE inv_app PASSWORD '${CLAVE_APP}'`);
    await enPrueba.$disconnect();

    const dueno = conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA);
    for (const [nombrePaso, r] of [
      ["migrate deploy", prisma(["migrate", "deploy"], dueno)],
      ["verificar-esquema.sql", ejecutarSql(ruta008("scripts/verificar-esquema.sql"), dueno)],
      ["privilegios.sql", ejecutarSql(ruta008("docker/migrador/privilegios.sql"), dueno)],
    ] as const) {
      if (r.status !== 0) throw new Error(`${nombrePaso}: ${r.stderr}`);
    }
    app = new PrismaClient({ datasources: { db: { url: conBase("inv_app", CLAVE_APP, BASE_PRUEBA) } } });
  }, 120_000);

  afterAll(async () => {
    await app?.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${BASE_PRUEBA} WITH (FORCE)`);
      await admin.$executeRawUnsafe("DROP ROLE IF EXISTS inv_app");
      await admin.$executeRawUnsafe("DROP ROLE IF EXISTS inv_dueno");
      await admin.$disconnect();
    }
  }, 60_000);

  const negado = async (sql: string) => {
    await expect(app.$executeRawUnsafe(sql)).rejects.toThrow(/42501|permission denied|must be owner/);
  };

  it("inv_app lee las tablas y compara citext (email) aunque PUBLIC no ejecute las funciones de inv_dueno", async () => {
    await expect(app.$queryRawUnsafe("SELECT count(*) FROM orden")).resolves.toBeDefined();
    await expect(app.$queryRawUnsafe("SELECT count(*) FROM usuario WHERE email = 'ficticio@ejemplo.invalid'")).resolves.toBeDefined();
  });

  it("inv_app hace exactamente las escrituras del login (y los disparadores corren con sus funciones)", async () => {
    const dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
    await dueno.$executeRawUnsafe(`INSERT INTO usuario (id, email, rol) VALUES ('u-roles', 'roles@ejemplo.invalid', 'DUENO')`);
    await dueno.$executeRawUnsafe(
      `INSERT INTO token_acceso (id, "usuarioId", "tokenHash", proposito, "venceEn") VALUES ('t-roles', 'u-roles', '${"a".repeat(64)}', 'INICIAL', now() + interval '10 minutes')`,
    );
    await dueno.$disconnect();
    await expect(app.$executeRawUnsafe(`UPDATE usuario SET "sesionVersion" = "sesionVersion" + 1, "bloqueadoHasta" = NULL WHERE id = 'u-roles'`)).resolves.toBe(1);
    await expect(app.$executeRawUnsafe(`INSERT INTO intento_ingreso (id, "usuarioId", resultado) VALUES ('i-roles', 'u-roles', 'EXITO')`)).resolves.toBe(1);
    await expect(app.$queryRawUnsafe(`SELECT id FROM token_acceso WHERE id = 't-roles' FOR UPDATE`)).resolves.toBeDefined();
    await expect(app.$executeRawUnsafe(`UPDATE token_acceso SET "usadoEn" = now() WHERE id = 't-roles'`)).resolves.toBe(1);
    // Segundo uso: lo frena el disparador (no un permiso).
    await expect(app.$executeRawUnsafe(`UPDATE token_acceso SET "usadoEn" = now() WHERE id = 't-roles'`)).rejects.toThrow(/un solo uso/);
  });

  for (const sql of [
    'INSERT INTO orden ("id") VALUES (\'x\')',
    "DELETE FROM usuario WHERE false",
    "TRUNCATE orden",
    "ALTER TABLE orden DISABLE TRIGGER orden_solo_insercion",
    "ALTER TABLE orden ADD COLUMN x int",
    "DROP TABLE orden",
    "CREATE TABLE intruso (id int)",
    "SELECT * FROM _prisma_migrations",
    "UPDATE precio_cierre SET precio = precio WHERE false",
    "UPDATE usuario SET activo = activo WHERE false",
    "UPDATE usuario SET rol = rol WHERE false",
    "UPDATE usuario SET email = email WHERE false",
    "UPDATE token_acceso SET \"venceEn\" = \"venceEn\" WHERE false",
    "UPDATE intento_ingreso SET resultado = resultado WHERE false",
    "DELETE FROM token_acceso WHERE false",
  ]) {
    it(`inv_app NO puede: ${sql}`, async () => {
      await negado(sql);
    });
  }

  it("inv_app NO puede saltarse la solo inserción con SET LOCAL inv.reversion", async () => {
    await expect(
      app.$transaction([app.$executeRawUnsafe("SET LOCAL inv.reversion = 'on'"), app.$executeRawUnsafe("DELETE FROM orden WHERE false")]),
    ).rejects.toThrow(/42501|permission denied/);
  });

  it("el guardián del esquema pasa en la base recién migrada (definiciones exactas de PostgreSQL 16)", () => {
    const r = ejecutarSql(ruta008("scripts/verificar-esquema.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
    expect(r.status, r.stderr).toBe(0);
  });

  it("el guardián falla si un CHECK cambia de definición o un disparador queda deshabilitado", async () => {
    const dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
    await dueno.$executeRawUnsafe('ALTER TABLE "orden" DROP CONSTRAINT "orden_montos_chk"');
    await dueno.$executeRawUnsafe('ALTER TABLE "orden" ADD CONSTRAINT "orden_montos_chk" CHECK (true)');
    await dueno.$executeRawUnsafe('ALTER TABLE "dividendo" DISABLE TRIGGER "dividendo_solo_insercion"');
    const r = ejecutarSql(ruta008("scripts/verificar-esquema.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/orden_montos_chk/);
    expect(r.stderr + r.stdout).toMatch(/dividendo_solo_insercion/);
    await dueno.$disconnect();
  });

  it("el guardián del esquema falla si falta un disparador escrito a mano", async () => {
    const dueno = new PrismaClient({ datasources: { db: { url: conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA) } } });
    await dueno.$executeRawUnsafe('DROP TRIGGER "orden_solo_insercion" ON "orden"');
    const r = ejecutarSql(ruta008("scripts/verificar-esquema.sql"), conBase("inv_dueno", CLAVE_DUENO, BASE_PRUEBA));
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/orden_solo_insercion/);
    await dueno.$disconnect();
  });
});

describe("roles de producción · fuera de CI", () => {
  it.skipIf(EN_CI)("se salta en el Mac a propósito: la verificación local se hace en el proyecto inv-008-prueba", () => {
    expect(EN_CI).toBe(false);
  });
});
