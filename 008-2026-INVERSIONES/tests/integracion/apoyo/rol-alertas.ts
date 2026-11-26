// El rol de inv_alertas en la base de PRUEBAS (Mac y CI), sin crear roles: son globales del clúster y el del Mac tiene la
// base de trabajo. Un rol predefinido sin ningún privilegio de tablas recibe EXACTAMENTE los GRANT que
// docker/migrador/privilegios.sql le da a inv_alertas (leídos del archivo, sin comentarios) más el USAGE del esquema que le da
// crear-roles-prod.sh, y un cliente de UNA conexión hace SET ROLE. La prueba con el rol real y el archivo entero es
// tests/unit/produccion/roles-base.test.ts (solo CI). No es una prueba (no termina en .test.ts).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PERMISOS_ALERTAS } from "../../unit/produccion/permisos-alertas";

const sql = readFileSync(fileURLToPath(new URL("../../../docker/migrador/privilegios.sql", import.meta.url)), "utf8").replace(/--.*$/gm, "");

/** Los GRANT de inv_alertas en privilegios.sql, tal cual (columnas: solo nombres, comillas, comas y espacios). */
export const GRANTS_ALERTAS = Object.freeze(
  [...sql.matchAll(/GRANT\s+([A-Z]+\s*(?:\([A-Za-z", ]*\))?)\s+ON\s+TABLE\s+public\.([a-z_]+)\s+TO\s+inv_alertas\s*;/g)].map((m) => Object.freeze({ privilegio: m[1]!, tabla: m[2]! })),
);

const TABLAS_ALERTAS = Object.freeze([...new Set(GRANTS_ALERTAS.map((g) => g.tabla))]);

/** Roles predefinidos de PostgreSQL 16 sin privilegios de tablas (ni leen archivos ni todas las tablas). */
const ROLES_SIN_TABLAS = new Set(["pg_signal_backend", "pg_use_reserved_connections"]);

export interface RolAlertas {
  readonly cliente: PrismaClient;
  /** El usuario con que corre de verdad el cliente (para comprobar que no volvió a ser el dueño). */
  readonly usuario: () => Promise<string | undefined>;
  /** Desconecta y quita los GRANT. */
  readonly soltar: () => Promise<void>;
}

/** REVOKE de tabla quita también los de columna. Idempotente: sirve para limpiar restos de una corrida muerta. */
async function revocar(db: PrismaClient, rol: string): Promise<void> {
  for (const t of TABLAS_ALERTAS) await db.$executeRawUnsafe(`REVOKE ALL ON TABLE public.${t} FROM ${rol}`);
  await db.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM ${rol}`);
}

async function exigirBaseDePruebas(db: PrismaClient): Promise<void> {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a dar permisos sobre «${base}»: solo bases *_test`);
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!decodeURIComponent(url.pathname).endsWith("_test")) throw new Error("DATABASE_URL no apunta a una base *_test");
}

/** Da a `rol` los permisos de inv_alertas en la base de `db` y abre un cliente de una conexión con SET ROLE. */
export async function conRolAlertas(db: PrismaClient, rol: string): Promise<RolAlertas> {
  if (!ROLES_SIN_TABLAS.has(rol)) throw new Error(`Rol no permitido para la prueba: ${rol}`);
  if (GRANTS_ALERTAS.length !== PERMISOS_ALERTAS.length) throw new Error(`Se leyeron ${GRANTS_ALERTAS.length} GRANT de inv_alertas en privilegios.sql; la lista única tiene ${PERMISOS_ALERTAS.length}`);
  await exigirBaseDePruebas(db);
  await revocar(db, rol);
  let cliente: PrismaClient | null = null;
  try {
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${rol}`);
    for (const g of GRANTS_ALERTAS) await db.$executeRawUnsafe(`GRANT ${g.privilegio} ON TABLE public.${g.tabla} TO ${rol}`);
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.searchParams.set("connection_limit", "1");
    cliente = new PrismaClient({ datasourceUrl: url.toString() });
    await cliente.$executeRawUnsafe(`SET ROLE ${rol}`);
  } catch (error) {
    await cliente?.$disconnect();
    await revocar(db, rol);
    throw error;
  }
  const abierto = cliente;
  const usuario = async (): Promise<string | undefined> => (await abierto.$queryRaw<{ u: string }[]>`SELECT current_user::text AS u`)[0]?.u;
  const soltar = async (): Promise<void> => {
    await abierto.$disconnect();
    await revocar(db, rol);
  };
  return Object.freeze({ cliente: abierto, usuario, soltar });
}
