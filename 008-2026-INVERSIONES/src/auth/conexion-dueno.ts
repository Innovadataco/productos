/**
 * El rol de la conexión de los comandos de accesos en producción. Lo comparten crear-acceso-inicial
 * (src/auth/acceso-cli.ts, para --reiniciar-totp) y acceso-familiar (src/auth/familia-cli.ts, para todo): en el VPS
 * corren en el migrador con `inv_dueno`, el dueño de las tablas. `inv_app` (la app) no puede ni debe administrar accesos.
 * Fuera de producción no se exige (pruebas y Mac).
 */
import type { PrismaClient } from "@prisma/client";
import type { FuenteOrigen } from "./origen";

export const ROL_DUENO = "inv_dueno";

/** true si no es producción o si la conexión es la de `inv_dueno`. */
export async function conexionDelDueno(db: PrismaClient, env: FuenteOrigen): Promise<boolean> {
  if (env.NODE_ENV !== "production") return true;
  const filas = await db.$queryRaw<{ rol: string }[]>`SELECT current_user::text AS "rol"`;
  return filas[0]?.rol === ROL_DUENO;
}
