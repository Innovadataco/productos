/**
 * Candado de sesión de `--aplicar` (`pg_try_advisory_lock`): dos importaciones a la vez podrían crear
 * dos versiones iguales, que no se pueden borrar (solo inserción). Vive en un cliente propio de UNA sola
 * conexión, sin cierre por inactividad, para tomarlo y soltarlo en la misma sesión. Si el proceso muere,
 * PostgreSQL lo suelta al cerrarse la conexión.
 */
import { PrismaClient } from "@prisma/client";

export const CLAVE_CANDADO = "008:importar-plan";

export interface Candado {
  /** Verdadero si el candado estaba tomado y se soltó; falso si no (ya suelto, o falló al soltarlo). */
  soltar(): Promise<boolean>;
}

function conUnaConexion(url: string): string {
  const u = new URL(url);
  u.searchParams.set("connection_limit", "1");
  // Sin esto, el pool cierra la conexión inactiva y el candado se suelta en silencio a mitad del trabajo.
  u.searchParams.set("max_idle_connection_lifetime", "0");
  return u.toString();
}

/** Nulo si otra importación lo tiene (no espera). */
export async function tomarCandado(url: string): Promise<Candado | null> {
  const cx = new PrismaClient({ datasourceUrl: conUnaConexion(url) });
  let tomado = false;
  try {
    const filas = await cx.$queryRaw<{ tomado: boolean }[]>`SELECT pg_try_advisory_lock(hashtext(${CLAVE_CANDADO})) AS tomado`;
    tomado = filas[0]?.tomado === true;
  } finally {
    if (!tomado) await cx.$disconnect();
  }
  if (!tomado) return null;
  let vigente = true;
  return {
    async soltar() {
      if (!vigente) return false;
      vigente = false;
      try {
        const filas = await cx.$queryRaw<{ suelto: boolean }[]>`SELECT pg_advisory_unlock(hashtext(${CLAVE_CANDADO})) AS suelto`;
        return filas[0]?.suelto === true;
      } catch {
        return false; // quien llama lo reporta (CANDADO_NO_SOLTADO); al desconectar, PostgreSQL lo suelta
      } finally {
        await cx.$disconnect().catch(() => undefined);
      }
    },
  };
}
