// El rol de inv_ia en la base de PRUEBAS (Mac y CI), sin crear roles: son globales del clúster y el del Mac tiene la
// base de trabajo. Un rol predefinido sin ningún privilegio de tablas recibe EXACTAMENTE los GRANT que
// docker/migrador/privilegios.sql le da a inv_ia (leídos del archivo, sin comentarios) más el USAGE del esquema que le da
// crear-roles-prod.sh, y un cliente de UNA conexión hace SET ROLE. La prueba con el rol real y el archivo entero es
// tests/unit/produccion/roles-base.test.ts (solo CI). No es una prueba (no termina en .test.ts).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const sql = readFileSync(fileURLToPath(new URL("../../../../docker/migrador/privilegios.sql", import.meta.url)), "utf8").replace(/--.*$/gm, "");

/** Los GRANT de inv_ia en privilegios.sql, tal cual. */
export const GRANTS_IA = Object.freeze(
  [...sql.matchAll(/GRANT\s+([A-Z]+\s*(?:\([^)]*\))?)\s+ON\s+TABLE\s+public\.([a-z_]+)\s+TO\s+inv_ia\s*;/g)].map((m) => Object.freeze({ privilegio: m[1]!, tabla: m[2]! })),
);

const TABLAS_IA = Object.freeze([...new Set(GRANTS_IA.map((g) => g.tabla))]);

/** Solo roles predefinidos que no tienen privilegios de tablas (ni leen archivos ni todas las tablas). */
const ROLES_SIN_TABLAS = new Set(["pg_signal_backend", "pg_checkpoint", "pg_use_reserved_connections"]);

export interface RolIa {
  readonly cliente: PrismaClient;
  /** Quita los GRANT y desconecta (REVOKE de tabla quita también los de columna). */
  readonly soltar: () => Promise<void>;
}

/** Da a `rol` los permisos de inv_ia en la base de `db` y abre un cliente de una conexión con SET ROLE. */
export async function conRolIa(db: PrismaClient, rol: string): Promise<RolIa> {
  if (!ROLES_SIN_TABLAS.has(rol)) throw new Error(`Rol no permitido para la prueba: ${rol}`);
  if (GRANTS_IA.length < 5) throw new Error("No se leyeron los GRANT de inv_ia de privilegios.sql");
  await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${rol}`);
  for (const g of GRANTS_IA) await db.$executeRawUnsafe(`GRANT ${g.privilegio} ON TABLE public.${g.tabla} TO ${rol}`);
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.searchParams.set("connection_limit", "1");
  const cliente = new PrismaClient({ datasourceUrl: url.toString() });
  await cliente.$executeRawUnsafe(`SET ROLE ${rol}`);
  const soltar = async (): Promise<void> => {
    await cliente.$disconnect();
    for (const t of TABLAS_IA) await db.$executeRawUnsafe(`REVOKE ALL ON TABLE public.${t} FROM ${rol}`);
    await db.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM ${rol}`);
  };
  return Object.freeze({ cliente, soltar });
}
